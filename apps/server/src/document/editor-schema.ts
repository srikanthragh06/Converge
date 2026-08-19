import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { editorSchema } from '@converge/shared';
import type * as Y from 'yjs';
import { withMutex } from '../utils/async-mutex.js';

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
