import type { DocumentBlock } from '@converge/shared';

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
