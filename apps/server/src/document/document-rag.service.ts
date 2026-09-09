import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../db/database.service.js';
import { DocumentEmbeddingService } from './document-embedding.service.js';
import { DocumentRerankService } from './document-rerank.service.js';
import { computeBm25Score, type Bm25Candidate } from '../utils/bm25.util.js';

// How many candidates each of semantic/lexical search contributes to the
// union before reranking — generous on purpose. Reranking (see
// DocumentRerankService) replaces the need for an accurate stage-1 ranking;
// stage 1 only has to make sure a relevant chunk is *somewhere* in the
// pool, so a wider net here costs one extra rerank candidate, not a wrong
// final answer.
const CANDIDATE_DEPTH = 30;

/** A single retrieved chunk, grounded with enough to cite it precisely. */
export interface RetrievalResult {
  citation: {
    workspaceId: number;
    documentId: number;
    blockIds: string[];
  };
  content: string;
  score: number;
}

/** The subset of a document_chunks row every candidate-generation query needs, regardless of which signal (semantic or lexical) found it. */
interface CandidateChunkRow {
  id: number;
  document_id: number;
  workspace_id: number;
  block_ids: string[];
  content: string;
}

/**
 * Orchestrates hybrid retrieval over a workspace's indexed content —
 * semantic (pgvector) and lexical (BM25, scored against the corpus stats
 * DocumentIndexingService maintains) candidates, unioned and reranked, with
 * every candidate query scoped to what the calling user can actually see.
 * No caller-facing strategy parameter — one task-shaped method, question in,
 * cited chunks out (see the RAG Discussion doc's "Tool design" decision).
 */
@Injectable()
export class DocumentRAGService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly documentEmbeddingService: DocumentEmbeddingService,
    private readonly documentRerankService: DocumentRerankService,
  ) {}

  /**
   * Answers a question by retrieving the most relevant indexed chunks from
   * a workspace, access-filtered to what userId can see.
   * @param question - the natural-language query
   * @param workspaceId - the workspace to search within
   * @param userId - the calling user, for access filtering
   * @param limit - maximum number of results to return
   * @returns cited chunks, most relevant first — empty if nothing accessible matches
   */
  async retrieve(
    question: string,
    workspaceId: number,
    userId: number,
    limit = 5,
  ): Promise<RetrievalResult[]> {
    const db = this.dbService.kysely;

    // Every candidate query below is scoped to this set — resolved once,
    // in bulk, the same resolved-access CASE expression DocumentService's
    // getLibraryDocuments/getTrashDocuments already use for listing, rather
    // than DocumentAccessService.resolveAccess called once per document.
    const accessibleDocs = await db
      .selectFrom('documents as d')
      .innerJoin('workspaces as w', 'w.id', 'd.workspace_id')
      .leftJoin('workspace_members as wm', (join) =>
        join
          .onRef('wm.workspace_id', '=', 'd.workspace_id')
          .on('wm.user_id', '=', userId),
      )
      .leftJoin('document_access as da', (join) =>
        join.onRef('da.document_id', '=', 'd.id').on('da.user_id', '=', userId),
      )
      .select(['d.id'])
      .select(
        sql<string>`
          CASE
            WHEN wm.role = 'owner' THEN 'owner'
            WHEN da.access IS NOT NULL THEN da.access
            WHEN wm.role = 'admin' THEN COALESCE(d.admin_doc_access, w.admin_doc_access)
            WHEN wm.role = 'member' THEN COALESCE(d.member_doc_access, w.member_doc_access)
            ELSE COALESCE(d.non_member_doc_access, w.non_member_doc_access)
          END
        `.as('access'),
      )
      .where('d.is_deleted', '=', false)
      .where('d.workspace_id', '=', workspaceId)
      .execute();

    const accessibleDocumentIds = accessibleDocs
      .filter((doc) => doc.access !== 'noAccess')
      .map((doc) => doc.id);
    if (accessibleDocumentIds.length === 0) return [];

    const [semanticCandidates, lexicalResult] = await Promise.all([
      this.getSemanticCandidates(question, workspaceId, accessibleDocumentIds),
      this.getLexicalCandidates(question, workspaceId, accessibleDocumentIds),
    ]);

    // Union by chunk id — no score fusion. A mediocre lexical or semantic
    // score could wrongly exclude or outrank a good candidate before
    // reranking ever sees it (confirmed on the rag-poc branch: RRF-fusing
    // the two let a noisy BM25 score bury a correct semantic hit on a
    // small, topically diverse document). A plain union can only ever add
    // extra candidates for the reranker to correctly discount.
    const candidateById = new Map<number, CandidateChunkRow>();
    for (const chunk of semanticCandidates) candidateById.set(chunk.id, chunk);
    for (const chunk of lexicalResult.candidates)
      candidateById.set(chunk.id, chunk);
    if (candidateById.size === 0) return [];

    // candidates is built once and never reordered before or after the
    // rerank call — Voyage's response indexes are positions into the exact
    // array of content strings we send it, so this fixed order is what lets
    // reranked[i].index map back to the right chunk below.
    const candidates = [...candidateById.values()];
    const reranked = await this.documentRerankService.rerank(
      question,
      candidates.map((chunk) => chunk.content),
      limit,
    );

    // Voyage already sorted and truncated to `limit` — just map its indexes
    // back onto the candidates that produced them.
    return reranked.map(({ index, relevanceScore }) => {
      const chunk = candidates[index];
      return {
        citation: {
          workspaceId: chunk.workspace_id,
          documentId: chunk.document_id,
          blockIds: chunk.block_ids,
        },
        content: chunk.content,
        score: relevanceScore,
      };
    });
  }

  /**
   * Semantic candidate generation — the question embedded via the same
   * model chunks were indexed with, ranked by pgvector cosine distance.
   * @param question - the natural-language query
   * @param workspaceId - the workspace to search within
   * @param accessibleDocumentIds - document ids the caller may see
   * @returns up to CANDIDATE_DEPTH chunks, closest first
   */
  private async getSemanticCandidates(
    question: string,
    workspaceId: number,
    accessibleDocumentIds: number[],
  ): Promise<CandidateChunkRow[]> {
    const db = this.dbService.kysely;
    const embedding = await this.documentEmbeddingService.embed(question);
    const vector = `[${embedding.join(',')}]`;

    return db
      .selectFrom('document_chunks')
      .select(['id', 'document_id', 'workspace_id', 'block_ids', 'content'])
      .where('workspace_id', '=', workspaceId)
      .where('document_id', 'in', accessibleDocumentIds)
      .orderBy(sql`embedding <=> ${vector}`)
      .limit(CANDIDATE_DEPTH)
      .execute();
  }

  /**
   * Lexical candidate generation — matches via the GIN-indexed content_tsv
   * column (so only chunks sharing vocabulary with the query are touched at
   * all), then scored with real BM25 against document_chunk_term_stats/
   * document_chunk_corpus_stats, since ts_rank_cd alone has no IDF
   * component. content_tsv @@ is built with the query's terms OR'd together
   * (not AND, websearch_to_tsquery's default) — a chunk matching only some
   * of the query's words is a real candidate, not a non-match; missing one
   * word out of several must never exclude it outright. Every @@ match gets
   * a real BM25 score before anything is discarded — no ts_rank_cd pre-cut
   * — since ts_rank_cd has no IDF and could otherwise drop the one chunk
   * BM25 would have correctly ranked highest (e.g. a rare, distinguishing
   * term ranked low on proximity alone) before BM25 ever saw it.
   * @param question - the natural-language query
   * @param workspaceId - the workspace to search within
   * @param accessibleDocumentIds - document ids the caller may see
   * @returns up to CANDIDATE_DEPTH chunks, highest BM25 score first
   */
  private async getLexicalCandidates(
    question: string,
    workspaceId: number,
    accessibleDocumentIds: number[],
  ): Promise<{ candidates: CandidateChunkRow[] }> {
    const db = this.dbService.kysely;

    // Tokenize the question with Postgres's own stemmer — the exact same
    // one content_tsv and document_chunk_term_stats were built with — so
    // term lookups line up without needing a second, possibly-divergent
    // tokenizer in application code.
    const tokenized = await db
      .selectFrom(
        sql<{
          term: string;
        }>`unnest(tsvector_to_array(to_tsvector('english', ${question})))`.as(
          'term',
        ),
      )
      .select(sql<string[]>`array_agg(term)`.as('terms'))
      .executeTakeFirstOrThrow();
    const queryTerms = (tokenized.terms ?? []).filter(Boolean);
    if (queryTerms.length === 0) return { candidates: [] };

    const orTermsQuery = queryTerms.join(' | ');

    const rows = await db
      .selectFrom('document_chunks')
      .select([
        'id',
        'document_id',
        'workspace_id',
        'block_ids',
        'content',
        'token_count',
        sql<string>`content_tsv::text`.as('tsvText'),
      ])
      .where('workspace_id', '=', workspaceId)
      .where('document_id', 'in', accessibleDocumentIds)
      .where(
        sql<boolean>`content_tsv @@ to_tsquery('english', ${orTermsQuery})`,
      )
      .execute();
    if (rows.length === 0) return { candidates: [] };

    // BM25's corpus-wide ingredients — how many chunks in this workspace
    // contain each query term, and the running totals behind average chunk
    // length — both maintained incrementally by DocumentIndexingService,
    // fetched here rather than computed live.
    const [termStatsRows, corpusStatsRow] = await Promise.all([
      db
        .selectFrom('document_chunk_term_stats')
        .select(['term', 'document_frequency'])
        .where('workspace_id', '=', workspaceId)
        .where('term', 'in', queryTerms)
        .execute(),
      db
        .selectFrom('document_chunk_corpus_stats')
        .select(['total_chunks', 'total_tokens'])
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst(),
    ]);
    const documentFrequencyByTerm = new Map(
      termStatsRows.map((row) => [row.term, row.document_frequency]),
    );
    const corpusStats = {
      documentFrequencyByTerm,
      totalChunks: corpusStatsRow?.total_chunks ?? 0,
      totalTokens: corpusStatsRow?.total_tokens ?? 0,
    };

    // Score every @@ match against the query terms using the real BM25
    // formula, then keep only the top CANDIDATE_DEPTH — the truncation
    // happens here, after scoring, not in the SQL query above, so a rare
    // but highly-relevant term can't be discarded before BM25 ever sees it.
    const scored = rows.map((row) => {
      const candidate: Bm25Candidate = {
        chunkId: row.id,
        tokenCount: row.token_count,
        termFrequencies: this.parseTermFrequencies(row.tsvText, queryTerms),
      };
      return {
        row,
        score: computeBm25Score(candidate, queryTerms, corpusStats),
      };
    });
    scored.sort((a, b) => b.score - a.score);

    return {
      candidates: scored.slice(0, CANDIDATE_DEPTH).map(({ row }) => ({
        id: row.id,
        document_id: row.document_id,
        workspace_id: row.workspace_id,
        block_ids: row.block_ids,
        content: row.content,
      })),
    };
  }

  /**
   * Extracts per-term occurrence counts for queryTerms out of a tsvector's
   * text representation (e.g. "'assam':7 'oil':2,15") — the cheapest way to
   * get an exact term frequency per chunk without a second SQL round trip
   * or a duplicate, possibly-divergent JS tokenizer.
   * @param tsvText - content_tsv cast to text
   * @param queryTerms - only these terms are worth extracting; BM25 never
   * needs a chunk's frequency for a term outside the query
   * @returns term -> occurrence count, for whichever queryTerms are present
   */
  private parseTermFrequencies(
    tsvText: string,
    queryTerms: string[],
  ): Map<string, number> {
    const queryTermSet = new Set(queryTerms);
    const frequencies = new Map<string, number>();
    // Matches each "'lexeme':pos,pos,..." entry in a tsvector's text form.
    // Assumes Postgres backslash-escapes a literal quote/backslash inside a
    // lexeme rather than doubling it SQL-string-style — not independently
    // verified, but English stemming essentially never produces a lexeme
    // containing a literal quote in the first place, so this is a narrow,
    // low-probability gap rather than a live concern.
    const lexemePattern = /'((?:[^'\\]|\\.)*)':([\d,]+)/g;
    let match: RegExpExecArray | null;
    while ((match = lexemePattern.exec(tsvText))) {
      const term = match[1].replace(/\\(.)/g, '$1');
      if (!queryTermSet.has(term)) continue;
      frequencies.set(term, match[2].split(',').length);
    }
    return frequencies;
  }
}
