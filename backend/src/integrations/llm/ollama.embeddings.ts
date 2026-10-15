import { OllamaEmbeddings } from '@langchain/ollama';
import { config } from '../../config/env';
import { withOllamaLimits } from './resilience';
import type { EmbeddingsProvider } from './llm.interface';

/**
 * Embeddings provider backed by a locally hosted Ollama embedding model
 * (e.g. nomic-embed-text).
 *
 * The exact same provider/model is used for both document ingestion and query
 * embedding, so the two vector spaces always match. The model identity is also
 * encoded into the ChromaDB collection name (see `config.chroma.collection`),
 * guaranteeing that vectors from different embedding models are never mixed.
 */
export class OllamaEmbeddingsProvider implements EmbeddingsProvider {
  private readonly client: OllamaEmbeddings;

  constructor() {
    this.client = new OllamaEmbeddings({
      model: config.llm.embeddingModel,
      baseUrl: config.llm.ollama.baseUrl,
      keepAlive: config.llm.ollama.keepAlive,
      // Truncate inputs that exceed the model context instead of failing the
      // whole document ingestion.
      truncate: true,
    });
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    return withOllamaLimits('Ollama document embedding', () =>
      this.client.embedDocuments(texts)
    );
  }

  async embedQuery(text: string): Promise<number[]> {
    return withOllamaLimits('Ollama query embedding', () =>
      this.client.embedQuery(text)
    );
  }
}
