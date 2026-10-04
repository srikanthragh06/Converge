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
    // A block split into pieces (see splitOversizedBlock) arrives as
    // several entries with the same id — list the id once.
    if (current.blockIds[current.blockIds.length - 1] !== block.blockId) {
      current.blockIds.push(block.blockId);
    }
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
 * Never cuts an entry itself — a block over MAX_TOKENS should already have
 * been split into pieces by splitOversizedBlock, and consecutive pieces of
 * one block can then land in different chunks.
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
    if (blockIds[blockIds.length - 1] !== block.blockId) {
      blockIds.push(block.blockId);
    }
    if (startsSmallSection) smallHeadingCount++;
  }

  flush();
  return chunks;
}

/**
 * Checks whether a block's lines start like a Markdown table: a pipe-led
 * header row followed by a separator row of dashes, colons and pipes.
 * @param lines - the block's text, split on newlines
 * @returns true if the first two lines are a table header and separator
 */
function isMarkdownTable(lines: string[]): boolean {
  if (lines.length < 2) return false;
  if (!lines[0].trim().startsWith('|')) return false;
  return /^\|?[\s:|-]+\|?$/.test(lines[1].trim());
}

/**
 * Cuts text into pieces of at most maxTokens tokens at exact token
 * boundaries — the last resort when a single sentence is over the cap. A
 * cut that lands inside a multi-byte character (an emoji, a CJK
 * character) decodes to a broken character that can count as more tokens,
 * so each cut moves back one token at a time until the piece ends on a
 * whole character and fits.
 * @param text - the text to cut
 * @param maxTokens - the most tokens a piece may have
 * @returns the pieces, in order
 */
function cutAtTokens(text: string, maxTokens: number): string[] {
  const tokens = encoding.encode(text);
  const pieces: string[] = [];
  let start = 0;
  while (start < tokens.length) {
    let end = Math.min(start + maxTokens, tokens.length);
    let piece = encoding.decode(tokens.slice(start, end));
    while (
      end - start > 1 &&
      (piece.endsWith('\uFFFD') || countTokens(piece) > maxTokens)
    ) {
      end--;
      piece = encoding.decode(tokens.slice(start, end));
    }
    pieces.push(piece);
    start = end;
  }
  return pieces;
}

/**
 * Breaks one line into units of at most maxTokens tokens: the whole line if
 * it fits, otherwise its sentences, and a sentence that still doesn't fit
 * is cut at exact token boundaries.
 * @param line - the line to break up
 * @param maxTokens - the most tokens a unit may have
 * @returns the units, in order
 */
function lineToUnits(line: string, maxTokens: number): string[] {
  if (countTokens(line) <= maxTokens) return [line];
  const units: string[] = [];
  for (const sentence of line.split(/(?<=[.!?])\s+/)) {
    if (countTokens(sentence) <= maxTokens) {
      units.push(sentence);
    } else {
      for (const piece of cutAtTokens(sentence, maxTokens)) {
        units.push(piece);
      }
    }
  }
  return units;
}

/**
 * Splits a single block over MAX_TOKENS into several pieces that each fit,
 * so no chunk ends up over the cap because of one big block (a long
 * paragraph, a big table or code block, or a top-level block with a large
 * subtree of children). Cuts at line ends first, then at sentence ends,
 * then at exact token boundaries. A table's header and separator rows are
 * repeated at the top of every piece so each piece's columns stay readable
 * on their own. Every piece keeps the block's id; only the first piece of a
 * heading stays marked as a heading, so the later pieces don't each start
 * a new section.
 * @param block - the block to split
 * @returns the block itself if it already fits, otherwise its pieces in order
 */
export function splitOversizedBlock(block: BlockText): BlockText[] {
  if (block.tokens <= MAX_TOKENS) return [block];

  let lines = block.text.split('\n');
  let header = '';
  if (isMarkdownTable(lines)) {
    const tableHeader = lines[0] + '\n' + lines[1];
    // Repeat the header only if it leaves at least half the cap for rows —
    // a header near MAX_TOKENS would leave no room (or a zero/negative
    // budget) for the rows themselves. A wider table is split as plain
    // lines instead.
    if (countTokens(tableHeader + '\n') <= MAX_TOKENS / 2) {
      header = tableHeader;
      lines = lines.slice(2);
    }
  }

  // Budget left for each piece's own content once the repeated header and
  // its newline are counted.
  let budget = MAX_TOKENS;
  if (header) {
    budget = MAX_TOKENS - countTokens(header + '\n');
  }

  const units: string[] = [];
  for (const line of lines) {
    for (const unit of lineToUnits(line, budget)) {
      units.push(unit);
    }
  }

  // Greedily pack units into pieces, re-counting the joined text so the cap
  // holds exactly rather than relying on per-unit counts adding up.
  const bodies: string[] = [];
  let current: string | null = null;
  for (const unit of units) {
    if (current === null) {
      current = unit;
    } else if (countTokens(current + '\n' + unit) <= budget) {
      current = current + '\n' + unit;
    } else {
      bodies.push(current);
      current = unit;
    }
  }
  if (current !== null) bodies.push(current);

  const pieces: BlockText[] = [];
  for (const body of bodies) {
    let text = body;
    if (header) {
      text = header + '\n' + body;
    }
    pieces.push({
      blockId: block.blockId,
      text,
      tokens: countTokens(text),
      isHeading: block.isHeading && pieces.length === 0,
    });
  }
  return pieces;
}
