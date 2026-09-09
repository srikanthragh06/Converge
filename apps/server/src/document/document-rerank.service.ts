import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** One reranked candidate — index into the original candidates array passed to rerank, plus Voyage's own relevance score. */
export interface RerankedCandidate {
  index: number;
  relevanceScore: number;
}

/**
 * Thin wrapper around Voyage's rerank endpoint. Candidates in, relevance-
 * sorted order out — no document/chunk/DB knowledge of its own, same split
 * as DocumentEmbeddingService for OpenAI. No SDK dependency needed for a
 * single POST call.
 */
@Injectable()
export class DocumentRerankService {
  private static readonly RERANK_MODEL = 'rerank-3'; // Voyage's cross-encoder reranker model.

  constructor(private readonly configService: ConfigService) {}

  /**
   * Reranks a set of candidate texts against a query using Voyage's
   * rerank-3 cross-encoder, which reads the query and each candidate
   * together rather than comparing independently-computed scores.
   * @param query - the search query
   * @param candidates - candidate texts to rerank, in the order the caller
   * will index back into
   * @param topK - maximum number of results to return
   * @returns candidates re-sorted by relevance, most relevant first
   */
  async rerank(
    query: string,
    candidates: string[],
    topK: number,
  ): Promise<RerankedCandidate[]> {
    // Read lazily here rather than in the constructor (unlike
    // DocumentEmbeddingService's eager OPENAI_API_KEY read) — VOYAGE_API_KEY
    // isn't required for the app to function yet, and NestJS eagerly
    // constructs every provider at boot, so validating it in the
    // constructor would stop the whole server from starting whenever the
    // key isn't configured, not just this one feature.
    const apiKey = this.configService.getOrThrow<string>('VOYAGE_API_KEY');

    // Single POST, no retry — a failure (including a 429) surfaces directly
    // to the caller rather than being silently retried.
    const response = await fetch('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DocumentRerankService.RERANK_MODEL,
        query,
        documents: candidates,
        top_k: topK,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Voyage rerank request failed: ${response.status} ${await response.text()}`,
      );
    }

    const body = (await response.json()) as {
      data: { index: number; relevance_score: number }[];
    };
    return body.data.map((d) => ({
      index: d.index,
      relevanceScore: d.relevance_score,
    }));
  }
}
