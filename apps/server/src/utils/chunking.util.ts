import { getEncoding } from 'js-tiktoken';

// cl100k_base matches OpenAI's text-embedding-3-small tokenizer.
const encoding = getEncoding('cl100k_base');

// Hard cap only — chunks greedily fill toward this rather than stopping
// early at a fixed target. Typical chunks land in the ~200-400 token range
// as a consequence of block sizes, not because of an early-stop rule.
const MAX_TOKENS = 500;

/**
 * Counts a string's tokens using the tokenizer text-embedding-3-small uses,
 * so chunk sizing tracks what the embedding model actually sees.
 * @param text - the text to count tokens for
 * @returns the token count
 */
export function countTokens(text: string): number {
  return encoding.encode(text).length;
}

/** A single block's id, text (as Markdown), and token count — chunkBlocks' input unit. */
export interface BlockText {
  blockId: string;
  text: string;
  tokens: number;
}

/** A contiguous run of blocks grouped into one chunk. */
export interface Chunk {
  blockIds: string[];
  content: string;
}

/**
 * Groups consecutive blocks into chunks up to MAX_TOKENS. Never splits a
 * block across two chunks — a single block over the cap becomes its own
 * (over-cap) chunk rather than being internally split.
 * @param blockTexts - blocks to chunk, in document order
 * @returns the resulting chunks, each spanning one or more consecutive blocks
 */
export function chunkBlocks(blockTexts: BlockText[]): Chunk[] {
  const chunks: Chunk[] = [];
  let blockIds: string[] = [];
  let texts: string[] = [];
  let tokens = 0;

  const flush = () => {
    if (blockIds.length === 0) return;
    chunks.push({ blockIds, content: texts.join('\n\n') });
    blockIds = [];
    texts = [];
    tokens = 0;
  };

  for (const block of blockTexts) {
    if (blockIds.length > 0 && tokens + block.tokens > MAX_TOKENS) {
      flush();
    }
    blockIds.push(block.blockId);
    texts.push(block.text);
    tokens += block.tokens;
  }

  flush();
  return chunks;
}
