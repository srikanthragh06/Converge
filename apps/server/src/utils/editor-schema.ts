import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { BlockNoteEditor } from '@blocknote/core';
import {
  editorSchema,
  type DocumentBlock,
  type BlockOperationDto,
} from '@converge/shared';
import * as Y from 'yjs';
import { withMutex } from './async-mutex.js';

// Safe to share across all calls: yDocToBlocks never touches
// globalThis.document/window, and blocksToMarkdownLossy's use of them (via
// @blocknote/server-util's _withJSDOM, a jsdom shim letting BlockNote's
// browser-oriented rendering code run in Node) is serialized through
// withMutex below, so only one call can ever be using those shared globals
// at a time — see async-mutex.ts.
const editor = ServerBlockNoteEditor.create({ schema: editorSchema });

/**
 * Converts a document's live Y.Doc into Markdown via the app's BlockNote schema.
 * Lossy: block ids, custom props, and any structure Markdown can't express
 * are dropped when converting Blocks to Markdown.
 * @param yDoc - the document's live Y.Doc, e.g. from DocumentYjsService.loadDoc
 * @returns the document's content as a Markdown string
 */
export function markdownFromYDoc(yDoc: Y.Doc): Promise<string> {
  const blocks = editor.yDocToBlocks(yDoc, 'blocknote');
  return withMutex(() => editor.blocksToMarkdownLossy(blocks));
}

/**
 * Converts a document's live Y.Doc into its BlockNote block JSON — the same
 * shape editor.document has client-side, ids and all. Not routed through
 * withMutex: yDocToBlocks is a pure Yjs-tree walk with no dependency on the
 * shared globalThis.document/window DOM globals (see async-mutex.ts).
 * @param yDoc - the document's live Y.Doc, e.g. from DocumentYjsService.loadDoc
 * @returns the document's content as an array of blocks
 */
export function blocksFromYDoc(yDoc: Y.Doc): DocumentBlock[] {
  return editor.yDocToBlocks(yDoc, 'blocknote');
}

/**
 * Applies a batch of id-addressed block edits to a document, atomically —
 * if any operation fails (e.g. a stale/nonexistent block id), none of them
 * are applied. Returns the resulting document's blocks and the Yjs update
 * bytes representing the change, ready to hand to
 * DocumentYjsService.applyDocUpdate — the caller is responsible for
 * persisting it; this function never touches the live Y.Doc.
 *
 * Runs entirely inside a single withMutex + _withJSDOM scope: everything
 * here (parsing Markdown, mounting a collaboration-bound editor) depends on
 * the shared globalThis.document/window jsdom shim, so it must be
 * serialized against every other call that also depends on it (see
 * async-mutex.ts).
 *
 * Never binds the collaboration editor to the live Y.Doc directly — it
 * operates on a throwaway copy instead, so this function can compute a
 * clean diff without ambiguity about whether DocumentYjsService.applyDocUpdate
 * would be re-applying an update the live doc already has.
 * @param liveYDoc - the document's live Y.Doc, e.g. from DocumentYjsService.loadDoc
 * @param operations - the edits to apply, in order
 * @returns the Yjs update bytes for the change, and the document's resulting blocks
 */
export function applyBlockOperations(
  liveYDoc: Y.Doc,
  operations: BlockOperationDto[],
): Promise<{ update: Uint8Array; blocks: DocumentBlock[] }> {
  return withMutex(() =>
    editor._withJSDOM(async () => {
      // Work on a throwaway copy of the document's current state, not the
      // live doc — see the doc comment above.
      const scratch = new Y.Doc();
      Y.applyUpdate(scratch, Y.encodeStateAsUpdate(liveYDoc));
      const fragment = scratch.getXmlFragment('blocknote');
      const beforeSV = Y.encodeStateVector(scratch);

      // Bind a real, collaboration-aware editor to the copy's fragment.
      // mount() is required — without it, this editor never syncs to the
      // fragment's actual content (see async-mutex.ts's sibling
      // investigation) — and it must be unmounted before this function
      // returns, or ProseMirror's EditorView leaves a dangling internal
      // timer that fires after this scope's jsdom globals are gone.
      const collabEditor = BlockNoteEditor.create({
        schema: editorSchema,
        // Without this, mount() unconditionally appends an empty trailing
        // paragraph (a UX convenience for a human clicking below the last
        // block) — confirmed empirically: it's present immediately after
        // mount(), before any operation runs. Harmless in the browser since
        // it's just an editing affordance, but here it would become a real,
        // permanently persisted extra block on every single write.
        trailingBlock: false,
        collaboration: {
          fragment,
          provider: {},
          user: { name: 'agent', color: '#000000' },
        },
      });
      collabEditor.mount(document.createElement('div'));

      try {
        // Apply each operation in order. remove needs no content; replace
        // and insert first turn their Markdown into blocks via the same
        // conversion readDocumentMarkdown's inverse would use, then apply
        // them through the real editor so the resulting Yjs ops are
        // proper incremental CRDT operations, not a wholesale rebuild.
        for (const op of operations) {
          if (op.type === 'remove') {
            collabEditor.removeBlocks(op.blockIds);
            continue;
          }

          const blocks = await editor.tryParseMarkdownToBlocks(op.markdown);
          if (op.type === 'replace') {
            collabEditor.replaceBlocks([op.blockId], blocks);
          } else {
            collabEditor.insertBlocks(blocks, op.referenceBlockId, op.placement);
          }
        }
      } finally {
        collabEditor.unmount();
      }

      // If any operation above threw, this line is never reached — nothing
      // gets diffed or returned, so a bad operation fails the whole batch
      // cleanly instead of partially applying edits.
      const update = Y.encodeStateAsUpdate(scratch, beforeSV);
      return { update, blocks: editor.yDocToBlocks(scratch, 'blocknote') };
    }),
  );
}
