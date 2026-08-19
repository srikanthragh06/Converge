import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { editorSchema } from '@converge/shared';
import type * as Y from 'yjs';

// Safe to share across all calls despite @blocknote/server-util internally
// mutating globalThis.document/window (a jsdom shim so BlockNote's
// browser-oriented rendering code runs in Node — see _withJSDOM) — verified
// empirically that blocksToMarkdownLossy reads what it needs before ever
// yielding, so a concurrent call's write can't land mid-read. That guarantee
// is specific to this method; other server-util methods that also go through
// _withJSDOM (blocksToFullHTML, blocksToHTMLLossy, tryParseHTMLToBlocks,
// tryParseMarkdownToBlocks) haven't been checked and shouldn't be assumed safe
// under concurrent use without the same kind of verification.
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
  return editor.blocksToMarkdownLossy(blocks);
}
