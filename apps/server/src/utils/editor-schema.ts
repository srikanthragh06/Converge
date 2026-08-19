import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { editorSchema, type DocumentBlock } from '@converge/shared';
import type * as Y from 'yjs';
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
