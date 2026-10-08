import type { DocumentBlock, OutlineHeadingDto } from '@converge/shared';
import { blockPlainText } from './block-text.util.js';
import { countTokens } from './chunking.util.js';

/** Where one block sits in a document's block tree. */
export type IndexedBlock = {
  /** The block itself, with its children. */
  block: DocumentBlock;
  /** The id of the block it's nested under, or null for a top-level block. */
  parentId: string | null;
  /** The list the block is in — its parent's children, or the top-level blocks. */
  siblings: DocumentBlock[];
  /** The block's position in siblings. */
  index: number;
};

/** Heading text in an outline is cut to this many characters. */
const OUTLINE_TEXT_LENGTH = 80;

/** An estimate of what reading a block and all its descendants costs, in tokens. */
export type BlockTokens = {
  /** Tokens of the block's text alone, as in Markdown. */
  plain: number;
  /** Tokens of the block as block JSON, ids and props included. */
  json: number;
};

/**
 * Maps every block in a document, parent or child, to its place in the
 * tree — one walk, so looking up many ids afterwards costs nothing extra.
 * @param blocks - the blocks to walk, e.g. a document's top-level blocks
 * @param parentId - the id of the block these are nested under, or null for top-level blocks
 * @param indexed - the map to add to; a new one when omitted
 * @returns a map from block id to the block's place in the tree
 */
export function indexBlocks(
  blocks: DocumentBlock[],
  parentId: string | null,
  indexed: Map<string, IndexedBlock> = new Map(),
): Map<string, IndexedBlock> {
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    indexed.set(block.id, { block, parentId, siblings: blocks, index });
    indexBlocks(block.children, block.id, indexed);
  }
  return indexed;
}

/**
 * Estimates the token cost of every block together with its descendants.
 * Each block is encoded once — its own text and its own JSON with the
 * children left out — and a block's total is that plus its children's
 * totals, so the work grows with the document's size, not its depth. Token
 * counts are not exactly additive, so these are estimates.
 * @param blocks - the blocks to walk, e.g. a document's top-level blocks
 * @param tokens - the map to add to; a new one when omitted
 * @returns a map from each block to the tokens it costs with its descendants
 */
export function blockTokens(
  blocks: DocumentBlock[],
  tokens: Map<DocumentBlock, BlockTokens> = new Map(),
): Map<DocumentBlock, BlockTokens> {
  for (const block of blocks) {
    blockTokens(block.children, tokens);

    const own = { ...block, children: [] };
    let plain = countTokens(blockPlainText(block));
    let json = countTokens(JSON.stringify(own));
    for (const child of block.children) {
      const childTokens = tokens.get(child)!;
      plain += childTokens.plain;
      json += childTokens.json;
    }
    tokens.set(block, { plain, json });
  }
  return tokens;
}

/**
 * Copies a block with its children cut off below the given depth. A block
 * whose children were cut off gets a childCount field, so an empty
 * children list is never mistaken for a block with no children. The
 * original block is left unchanged — the same block can appear in several
 * results of one call.
 * @param block - the block to copy
 * @param depth - how many levels of children to keep: -1 for all, 0 for none
 * @returns the copied block
 */
export function limitDepth(block: DocumentBlock, depth: number): DocumentBlock {
  if (depth === -1) {
    return block;
  } else if (depth === 0) {
    if (block.children.length === 0) {
      return block;
    }
    const cut = { ...block, children: [], childCount: block.children.length };
    return cut as DocumentBlock;
  }

  const children: DocumentBlock[] = [];
  for (const child of block.children) {
    children.push(limitDepth(child, depth - 1));
  }
  return { ...block, children };
}

/**
 * Returns a block's heading level, or null if it isn't a heading.
 * @param block - the block to check
 * @returns the heading level, or null
 */
function headingLevel(block: DocumentBlock): number | null {
  if (block.type !== 'heading') {
    return null;
  }
  return (block.props as { level: number }).level;
}

/**
 * Lists every heading in a block tree, in document order, with its text
 * cut short and two counts of the sibling blocks after it: up to the next
 * heading of any level (the heading's own content), and up to the next
 * heading of the same or a higher level (its whole section). Both counts
 * are made to be passed as after to getBlocksById. Each heading also gets
 * the estimated tokens of its whole section, as text and as block JSON.
 * @param blocks - the blocks to walk, e.g. a document's top-level blocks
 * @param parentId - the id of the block these are nested under, or null for top-level blocks
 * @param headings - the list to add to; a new one when omitted
 * @param tokens - each block's token cost, from blockTokens over the whole tree; built from blocks when omitted
 * @returns every heading in the tree
 */
export function outlineHeadings(
  blocks: DocumentBlock[],
  parentId: string | null,
  headings: OutlineHeadingDto[] = [],
  tokens: Map<DocumentBlock, BlockTokens> = blockTokens(blocks),
): OutlineHeadingDto[] {
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const level = headingLevel(block);

    if (level !== null) {
      let blockCount = 0;
      while (
        index + 1 + blockCount < blocks.length &&
        headingLevel(blocks[index + 1 + blockCount]) === null
      ) {
        blockCount++;
      }

      let sectionBlockCount = 0;
      while (index + 1 + sectionBlockCount < blocks.length) {
        const nextLevel = headingLevel(blocks[index + 1 + sectionBlockCount]);
        if (nextLevel !== null && nextLevel <= level) {
          break;
        }
        sectionBlockCount++;
      }

      // The section is the heading plus the sectionBlockCount blocks after it.
      let sectionPlainTokens = 0;
      let sectionJsonTokens = 0;
      for (let i = index; i <= index + sectionBlockCount; i++) {
        const sectionTokens = tokens.get(blocks[i])!;
        sectionPlainTokens += sectionTokens.plain;
        sectionJsonTokens += sectionTokens.json;
      }

      let text = blockPlainText(block).replace(/\s+/g, ' ').trim();
      if (text.length > OUTLINE_TEXT_LENGTH) {
        text = text.slice(0, OUTLINE_TEXT_LENGTH) + '…';
      }

      headings.push({
        id: block.id,
        parentId,
        level,
        text,
        blockCount,
        sectionBlockCount,
        sectionPlainTokens,
        sectionJsonTokens,
      });
    }

    outlineHeadings(block.children, block.id, headings, tokens);
  }
  return headings;
}
