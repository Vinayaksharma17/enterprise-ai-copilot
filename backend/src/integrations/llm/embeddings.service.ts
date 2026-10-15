import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../../config/env';
import { OllamaEmbeddingsProvider } from './ollama.embeddings';
import type { EmbeddingsProvider } from './llm.interface';

export class OpenAIEmbeddingsProvider implements EmbeddingsProvider {
  private readonly client: OpenAIEmbeddings;

  constructor() {
    if (!config.llm.embeddingApiKey) {
      throw new Error('EMBEDDING_API_KEY is not configured');
    }
    this.client = new OpenAIEmbeddings({
      apiKey: config.llm.embeddingApiKey,
      model: config.llm.embeddingModel,
      configuration: config.llm.embeddingBaseUrl
        ? { baseURL: config.llm.embeddingBaseUrl }
        : undefined,
    });
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    return this.client.embedDocuments(texts);
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.client.embedQuery(text);
  }
}

/**
 * Builds the embeddings provider selected by `EMBEDDING_PROVIDER`. The same
 * provider and model are used for document ingestion and query embedding, so
 * the two vector spaces always match.
 */
export const createEmbeddingsProvider = (): EmbeddingsProvider => {
  if (config.llm.embeddingProvider === 'ollama') {
    return new OllamaEmbeddingsProvider();
  }
  return new OpenAIEmbeddingsProvider();
};

let embeddingsProviderInstance: EmbeddingsProvider | undefined;

export const getEmbeddingsProvider = (): EmbeddingsProvider => {
  if (!embeddingsProviderInstance) {
    embeddingsProviderInstance = createEmbeddingsProvider();
  }
  return embeddingsProviderInstance;
};

export const setEmbeddingsProviderForTesting = (
  provider: EmbeddingsProvider
): void => {
  embeddingsProviderInstance = provider;
};
