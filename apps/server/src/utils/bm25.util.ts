// Standard Okapi BM25, computed against the corpus-wide stats
// DocumentIndexingService maintains incrementally (document_chunk_term_stats,
// document_chunk_corpus_stats) rather than derived live from a full scan —
// see the RAG Discussion doc's retrieval-phase notes for why plain
// tsvector/ts_rank_cd alone can't produce this (no IDF component).

// Standard Okapi BM25 defaults — same constants the rag-poc branch's eval
// validated, not independently tuned here.
const K1 = 1.5; // term-frequency saturation — higher means additional occurrences of a term keep mattering longer before diminishing returns kick in.
const B = 0.75; // length-normalization strength — 0 ignores chunk length entirely, 1 fully normalizes against it.

/** One candidate chunk's own term frequencies — how many times each query term appears in *this* chunk specifically. */
export interface Bm25Candidate {
  chunkId: number;
  tokenCount: number;
  /** term -> occurrence count within this chunk, for query terms only (terms absent from the chunk are simply missing from the map). */
  termFrequencies: Map<string, number>;
}

/** Workspace-wide stats a chunk's own content can't provide on its own. */
export interface Bm25CorpusStats {
  /** How many chunks in the workspace contain each query term — terms absent from the workspace are simply missing from the map (treated as document_frequency 0 below). */
  documentFrequencyByTerm: Map<string, number>;
  totalChunks: number;
  totalTokens: number;
}

/**
 * Scores one candidate chunk against a set of query terms using the
 * standard Okapi BM25 formula (k1=1.5, b=0.75 — same constants the rag-poc
 * branch's eval validated). A term with document_frequency 0 (absent from
 * documentFrequencyByTerm) still contributes a well-defined, large positive
 * IDF rather than being skipped — the "+1" inside the log keeps this finite
 * and correctly signals "this exact term appears nowhere else in the
 * workspace," rather than treating it as a de facto stop word.
 * @param candidate - the chunk being scored, with its own term frequencies
 * @param queryTerms - the query's lexemes (Postgres-stemmed, matching
 * document_chunk_term_stats' tokenization exactly)
 * @param corpusStats - workspace-wide document frequency and length stats
 * @returns the chunk's BM25 score for this query — higher is more relevant
 */
export function computeBm25Score(
  candidate: Bm25Candidate,
  queryTerms: string[],
  corpusStats: Bm25CorpusStats,
): number {
  const avgDocLength =
    corpusStats.totalChunks > 0
      ? corpusStats.totalTokens / corpusStats.totalChunks
      : 0;

  let score = 0;
  for (const term of queryTerms) {
    const tf = candidate.termFrequencies.get(term);
    if (!tf) continue; // this query term never appears in this chunk — contributes nothing

    const documentFrequency =
      corpusStats.documentFrequencyByTerm.get(term) ?? 0;
    const idf = Math.log(
      1 +
        (corpusStats.totalChunks - documentFrequency + 0.5) /
          (documentFrequency + 0.5),
    );

    const numerator = tf * (K1 + 1);
    const denominator =
      tf + K1 * (1 - B + (B * candidate.tokenCount) / (avgDocLength || 1));
    score += idf * (numerator / denominator);
  }
  return score;
}
