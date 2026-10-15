import type {
  ChatProvider,
  ChatMessage,
  EmbeddingsProvider,
} from '../../src/integrations/llm/llm.interface';
import type {
  RetrievedChunk,
  VectorChunkRecord,
  VectorQueryOptions,
  VectorStore,
} from '../../src/integrations/vector-store/vector-store.service';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'to', 'and', 'in', 'on',
  'for', 'what', 'how', 'does', 'do', 'with', 'must', 'may', 'be', 'by', 'at',
  'least', 'its', 'it', 'per', 'as', 'or', 'this', 'that', 'what', 'which',
  'company', 'please', 'tell', 'me', 'about',
]);

const tokenize = (text: string): string[] =>
  (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (token) => token.length > 1 && !STOPWORDS.has(token)
  );

const VECTOR_SIZE = 4096;

const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Deterministic, offline embeddings based on a token registry. Every distinct
 * token is assigned a unique dimension, so texts that share no tokens have zero
 * cosine similarity (no hash collisions). This lets tests exercise real
 * retrieval behaviour without any network access.
 */
export class DeterministicEmbeddingsProvider implements EmbeddingsProvider {
  private readonly tokenIndex = new Map<string, number>();
  private nextIndex = 0;

  encode(text: string): number[] {
    const vector = new Array(VECTOR_SIZE).fill(0);
    for (const token of tokenize(text)) {
      let index = this.tokenIndex.get(token);
      if (index === undefined) {
        index = this.nextIndex % VECTOR_SIZE;
        this.nextIndex += 1;
        this.tokenIndex.set(token, index);
      }
      vector[index] += 1;
    }
    return vector;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.encode(text));
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.encode(text);
  }
}

export class InMemoryVectorStore implements VectorStore {
  private readonly records = new Map<string, VectorChunkRecord>();

  async ensureCollection(): Promise<void> {
    return undefined;
  }

  async upsertChunks(records: VectorChunkRecord[]): Promise<void> {
    for (const record of records) {
      this.records.set(record.chunkId, record);
    }
  }

  async deleteByDocumentIds(documentIds: string[]): Promise<void> {
    for (const [chunkId, record] of this.records.entries()) {
      if (documentIds.includes(record.metadata.documentId)) {
        this.records.delete(chunkId);
      }
    }
  }

  async querySimilar(options: VectorQueryOptions): Promise<RetrievedChunk[]> {
    if (
      options.authorizedDocumentIds !== undefined &&
      options.authorizedDocumentIds.length === 0
    ) {
      return [];
    }

    const results: RetrievedChunk[] = [];

    for (const record of this.records.values()) {
      if (
        options.authorizedDocumentIds !== undefined &&
        !options.authorizedDocumentIds.includes(record.metadata.documentId)
      ) {
        continue;
      }

      const similarity = cosineSimilarity(options.embedding, record.embedding);
      if (similarity <= 0) {
        continue;
      }

      results.push({
        chunkId: record.chunkId,
        documentId: record.metadata.documentId,
        text: record.text,
        distance: 1 - similarity,
        metadata: record.metadata,
      });
    }

    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, options.topK);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  count(): number {
    return this.records.size;
  }
}

export const createMockChatProvider = (
  answer: string | ((messages: ChatMessage[]) => string)
): ChatProvider & { generate: jest.Mock } => {
  const generate = jest.fn(async (messages: ChatMessage[]) =>
    typeof answer === 'function' ? answer(messages) : answer
  );
  return { generate } as ChatProvider & { generate: jest.Mock };
};
