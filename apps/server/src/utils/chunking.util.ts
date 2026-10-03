import { getEncoding } from 'js-tiktoken';

// cl100k_base matches OpenAI's text-embedding-3-small tokenizer.
const encoding = getEncoding('cl100k_base');

// Hard cap only — chunks greedily fill toward this rather than stopping
// early at a fixed target. Typical chunks land in the ~200-400 token range
// as a consequence of block sizes, not because of an early-stop rule.
const MAX_TOKENS = 500;

// A chunk closes as soon as adding another "small" heading (see
// SMALL_SECTION_TOKENS) would bring its count above this, even under the
// token cap. Validated via a chunking-quality eval run against two
// unrelated test documents: the only reproducible retrieval failure found
// was several short, unrelated heading-marked facts (a glossary, a bullet
// list of examples) packed into one chunk and diluting each other's
// embedding — this cap targets exactly that pattern.
const MAX_SMALL_HEADINGS = 3;

// A heading's section only counts toward MAX_SMALL_HEADINGS if the section
// itself (the heading plus everything up to the next heading) is under this
// many tokens. Without this, the cap also fragmented substantial sections
// (a real paragraph) that were never the problem, measurably regressing
// retrieval on content it split unnecessarily. The glossary/list cases the
// cap targets run ~15-30 tokens per section, well under this threshold.
const SMALL_SECTION_TOKENS = 80;

/**
 * Counts a string's tokens using the tokenizer text-embedding-3-small uses,
 * so chunk sizing tracks what the embedding model actually sees.
 * @param text - the text to count tokens for
 * @returns the token count
 */
export function countTokens(text: string): number {
  return encoding.encode(text).length;
}

/** A single block's id, text (as Markdown), token count, and whether it's a heading — chunkBlocks' input unit. */
export interface BlockText {
  blockId: string;
  text: string;
  tokens: number;
  isHeading: boolean;
}

/** A contiguous run of blocks grouped into one chunk. */
export interface Chunk {
  blockIds: string[];
  content: string;
  /** Token count of content itself (the blocks plus the blank lines joining them), counted once when the chunk closes so callers (e.g. the BM25 corpus-length stats) don't need to re-tokenize it. */
  tokens: number;
}

/** A run of blocks from one heading up to (not including) the next — or, for content before the document's first heading, a headingless leading run. */
export interface Section {
  blockIds: string[];
  tokens: number;
  hasHeading: boolean;
}

/**
 * Groups blocks into sections at heading boundaries — each section is one
 * heading plus every block that follows it up to (not including) the next
 * heading. Content before the document's first heading forms its own
 * headingless section. Exported separately from chunkBlocks because
 * DocumentIndexingService's incremental rebuild also needs to know which
 * blocks share a section, independent of how those blocks end up chunked.
 * @param blockTexts - blocks to group, in document order
 * @returns the resulting sections, in document order
 */
export function groupIntoSections(blockTexts: BlockText[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const block of blockTexts) {
    if (block.isHeading || current === null) {
      current = { blockIds: [], tokens: 0, hasHeading: block.isHeading };
      sections.push(current);
    }
    current.blockIds.push(block.blockId);
    current.tokens += block.tokens;
  }
  return sections;
}

/**
 * Groups consecutive blocks into chunks. A chunk closes — starting a new
 * one — as soon as either limit is hit, whichever comes first:
 *  - the MAX_TOKENS cap, checked block by block against the joined chunk
 *    text (blank lines between blocks included); or
 *  - a 4th "small" heading section (see SMALL_SECTION_TOKENS) would join
 *    the chunk, even though the token cap alone wouldn't have closed it yet.
 * Never splits a single block across two chunks — a block over MAX_TOKENS
 * on its own becomes its own (over-cap) chunk instead.
 * @param blockTexts - blocks to chunk, in document order (does not need to
 * be a whole document — DocumentIndexingService also calls this per
 * contiguous run of an incremental rebuild)
 * @returns the resulting chunks, each spanning one or more consecutive blocks
 */
export function chunkBlocks(blockTexts: BlockText[]): Chunk[] {
  const sections = groupIntoSections(blockTexts);
  // The block id a small section starts with — the point at which the
  // heading-count check below should fire.
  const smallSectionStartIds = new Set(
    sections
      .filter(
        (section) =>
          section.hasHeading && section.tokens < SMALL_SECTION_TOKENS,
      )
      .map((section) => section.blockIds[0]),
  );

  const chunks: Chunk[] = [];
  let blockIds: string[] = [];
  let content = '';
  let smallHeadingCount = 0;

  const flush = () => {
    if (blockIds.length === 0) return;
    chunks.push({ blockIds, content, tokens: countTokens(content) });
    blockIds = [];
    content = '';
    smallHeadingCount = 0;
  };

  for (const block of blockTexts) {
    const startsSmallSection = smallSectionStartIds.has(block.blockId);

    // Close the current chunk if this block would push it past either
    // limit. The token cap is checked on the joined text itself, since the
    // blank line between blocks costs tokens too.
    if (blockIds.length > 0) {
      const joinedTokens = countTokens(content + '\n\n' + block.text);
      const wouldExceedSmallHeadings =
        startsSmallSection && smallHeadingCount + 1 > MAX_SMALL_HEADINGS;
      if (joinedTokens > MAX_TOKENS || wouldExceedSmallHeadings) {
        flush();
      }
    }

    if (blockIds.length === 0) {
      content = block.text;
    } else {
      content = content + '\n\n' + block.text;
    }
    blockIds.push(block.blockId);
    if (startsSmallSection) smallHeadingCount++;
  }

  flush();
  return chunks;
}
