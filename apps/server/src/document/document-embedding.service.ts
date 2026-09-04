import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Thin wrapper around OpenAI's embeddings API. Text in, vector out — no
 * document/chunk/DB knowledge of its own, so DocumentIndexingService is
 * free to call it per-chunk without this service caring what a chunk is.
 */
@Injectable()
export class DocumentEmbeddingService {
  private readonly openai: OpenAI; // OpenAI SDK client, constructed once per instance with the configured API key.

  // text-embedding-3-small: 1536-dimensional output, matching the
  // vector(1536) column document_chunks.embedding was migrated with.
  private static readonly EMBEDDING_MODEL = 'text-embedding-3-small';

  constructor(private readonly configService: ConfigService) {
    // Passed explicitly rather than relying on the SDK's implicit
    // process.env.OPENAI_API_KEY read, matching how every other service in
    // this app sources config through ConfigService.
    this.openai = new OpenAI({
      apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Embeds a string via OpenAI's text-embedding-3-small model.
   * @param text - the text to embed, e.g. a chunk's Markdown content
   * @returns the embedding as a 1536-length array of floats
   */
  async embed(text: string): Promise<number[]> {
    // A single string input always returns exactly one embedding.
    const response = await this.openai.embeddings.create({
      model: DocumentEmbeddingService.EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0].embedding;
  }
}
