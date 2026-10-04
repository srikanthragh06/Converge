import { getEncoding } from 'js-tiktoken';

// cl100k_base matches OpenAI's text-embedding-3-small tokenizer.
const encoding = getEncoding('cl100k_base');

// Hard cap only — chunks greedily fill toward this rather than stopping
// early at a fixed target. Typical chunks land in the ~200-400 token range
// as a consequence of block sizes, not because of an early-stop rule.
const MAX_TOKENS = 500;

// A heading starts a new chunk once the current chunk already holds at least
// this many tokens, so chunks tend to break at topic boundaries instead of
// running one topic straight into the next. Below it, a heading still joins
// the current chunk, so several short sections can share one chunk rather
// than each becoming a tiny chunk with too little text to embed well.
const HEADING_BREAK_TOKENS = MAX_TOKENS / 2;

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

/**
 * Groups consecutive blocks into chunks, greedily filling each one up to
 * MAX_TOKENS — checked block by block against the joined chunk text (blank
 * lines between blocks included). A new chunk starts when the next block
 * wouldn't fit, or when the next block is a heading and the current chunk
 * already holds HEADING_BREAK_TOKENS. Both checks only look at the current
 * chunk and the next block, so a partial rebuild of any contiguous run gets
 * the same rules as a full one. Never cuts an entry itself — a block over MAX_TOKENS
 * should already have been split into pieces by splitOversizedBlock, and
 * consecutive pieces of one block can then land in different chunks.
 * @param blockTexts - blocks to chunk, in document order (does not need to
 * be a whole document — DocumentIndexingService also calls this per
 * contiguous run of an incremental rebuild)
 * @returns the resulting chunks, each spanning one or more consecutive blocks
 */
export function chunkBlocks(blockTexts: BlockText[]): Chunk[] {
  const chunks: Chunk[] = [];
  let blockIds: string[] = [];
  let content = '';

  const flush = () => {
    if (blockIds.length === 0) return;
    chunks.push({ blockIds, content, tokens: countTokens(content) });
    blockIds = [];
    content = '';
  };

  for (const block of blockTexts) {
    // Close the current chunk if this block would push it past the cap —
    // counted on the joined text itself, since the blank line between
    // blocks costs tokens too — or if it's a heading and the chunk already
    // holds enough text to stand on its own.
    if (blockIds.length > 0) {
      const joinedTokens = countTokens(content + '\n\n' + block.text);
      let startsNewTopic = false;
      if (block.isHeading) {
        startsNewTopic = countTokens(content) >= HEADING_BREAK_TOKENS;
      }
      if (joinedTokens > MAX_TOKENS || startsNewTopic) {
        flush();
      }
    }

    if (blockIds.length === 0) {
      content = block.text;
    } else {
      content = content + '\n\n' + block.text;
    }
    // A block split into pieces (see splitOversizedBlock) arrives as
    // several entries with the same id — list the id once.
    if (blockIds[blockIds.length - 1] !== block.blockId) {
      blockIds.push(block.blockId);
    }
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
 * heading stays marked as a heading, so the later pieces don't each start a
 * new chunk.
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
