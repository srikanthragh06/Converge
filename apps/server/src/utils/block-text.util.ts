import type { DocumentBlock } from '@converge/shared';

// Reads a block's plain text straight from its JSON content rather than
// converting it to Markdown — Markdown conversion goes through the shared
// jsdom shim and its mutex (see editor-schema.ts), far too slow for walking
// every block of a large document on each call.

/**
 * Joins the text of a list of inline content items — plain text items and
 * the text inside links. Bold/italic/etc. split one sentence into several
 * items, so they're joined with no separator to keep it searchable as one.
 * @param items - a block's (or table cell's) inline content array
 * @returns the items' text, joined
 */
function inlineText(items: unknown[]): string {
  let text = '';
  for (const item of items) {
    const inline = item as { type?: string; text?: string; content?: unknown };
    if (inline.type === 'text' && typeof inline.text === 'string') {
      text += inline.text;
    } else if (inline.type === 'link' && Array.isArray(inline.content)) {
      text += inlineText(inline.content);
    }
  }
  return text;
}

/**
 * Joins a table's cells — " | " between the cells of a row, a new line
 * between rows. A cell is either an inline content array or a tableCell
 * object wrapping one, depending on whether it carries cell-level props.
 * @param tableContent - a table block's content object
 * @returns the table's text, row by row
 */
function tableText(tableContent: { rows?: unknown[] }): string {
  const rowTexts: string[] = [];
  for (const row of tableContent.rows ?? []) {
    const cellTexts: string[] = [];
    for (const cell of (row as { cells?: unknown[] }).cells ?? []) {
      if (Array.isArray(cell)) {
        cellTexts.push(inlineText(cell));
      } else {
        const content = (cell as { content?: unknown }).content;
        if (Array.isArray(content)) {
          cellTexts.push(inlineText(content));
        } else {
          cellTexts.push('');
        }
      }
    }
    rowTexts.push(cellTexts.join(' | '));
  }
  return rowTexts.join('\n');
}

/**
 * Returns a block's own plain text, without its children's. Covers the
 * three places a block can keep text: inline content (paragraphs, headings,
 * lists, code blocks), table content, and — for blocks with no content,
 * such as images and files — the name and caption props.
 * @param block - the block to read
 * @returns the block's text, or '' if it has none
 */
export function blockPlainText(block: DocumentBlock): string {
  const content: unknown = block.content;
  if (Array.isArray(content)) {
    return inlineText(content);
  } else if (
    content !== null &&
    typeof content === 'object' &&
    (content as { type?: string }).type === 'tableContent'
  ) {
    return tableText(content as { rows?: unknown[] });
  }

  const props = block.props as { name?: unknown; caption?: unknown };
  const parts: string[] = [];
  if (typeof props.name === 'string' && props.name) parts.push(props.name);
  if (typeof props.caption === 'string' && props.caption) {
    parts.push(props.caption);
  }
  return parts.join('\n');
}

/**
 * Lists every block in a document, parent or child, in document order,
 * each with the id of the block it's nested under — a depth-first walk,
 * so a parent is always directly followed by its own children.
 * @param blocks - the blocks to walk, e.g. a document's top-level blocks
 * @param parentId - the id of the block these are nested under, or null for top-level blocks
 * @returns every block in the tree with its parent id, in document order
 */
export function flattenBlocksWithParents(
  blocks: DocumentBlock[],
  parentId: string | null,
): { block: DocumentBlock; parentId: string | null }[] {
  const flat: { block: DocumentBlock; parentId: string | null }[] = [];
  for (const block of blocks) {
    flat.push({ block, parentId });
    for (const descendant of flattenBlocksWithParents(
      block.children,
      block.id,
    )) {
      flat.push(descendant);
    }
  }
  return flat;
}

/**
 * Cuts a short excerpt of a block's text around a match, on one line,
 * with "…" wherever the text was cut.
 * @param blockText - the block's full plain text
 * @param index - where the match starts in blockText
 * @param matchLength - the match's length
 * @returns the excerpt
 */
export function matchPreview(
  blockText: string,
  index: number,
  matchLength: number,
): string {
  // About 80 characters in all — a little context before the match and
  // the rest after it.
  const start = Math.max(0, index - 30);
  const end = Math.min(
    blockText.length,
    Math.max(index + matchLength, start + 80),
  );
  let preview = blockText.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) preview = '…' + preview;
  if (end < blockText.length) preview = preview + '…';
  return preview;
}
