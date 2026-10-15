import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../../config/env';
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

let embeddingsProviderInstance: EmbeddingsProvider | undefined;

export const getEmbeddingsProvider = (): EmbeddingsProvider => {
  if (!embeddingsProviderInstance) {
    embeddingsProviderInstance = new OpenAIEmbeddingsProvider();
  }
  return embeddingsProviderInstance;
};

export const setEmbeddingsProviderForTesting = (
  provider: EmbeddingsProvider
): void => {
  embeddingsProviderInstance = provider;
};
