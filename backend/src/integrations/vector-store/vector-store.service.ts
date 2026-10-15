import { config } from '../../config/env';
import {
  ChromaClient,
  ChromaMetadata,
  ChromaMetadataValue,
} from './chroma.client';

export interface VectorChunkMetadata {
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  department?: string;
  accessLevel: 'public' | 'restricted';
  /**
   * Chroma metadata values are scalars, so the list of allowed departments is
   * stored as a comma-separated string. It is informational only; authorization
   * filtering is performed with `documentId`, which is resolved from trusted
   * MongoDB records before retrieval.
   */
  allowedDepartments: string;
  documentName: string;
  pageNumber?: number;
  /** Embedding model that produced the vector, recorded for provenance. */
  embeddingModel?: string;
}

export interface VectorChunkRecord {
  chunkId: string;
  embedding: number[];
  text: string;
  metadata: VectorChunkMetadata;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  text: string;
  distance: number;
  metadata: VectorChunkMetadata;
}

export interface VectorQueryOptions {
  embedding: number[];
  topK: number;
  /**
   * Authorized document ids resolved from trusted database records. When
   * provided, only vectors belonging to these documents are eligible. An empty
   * list short-circuits to no results so unauthorized data is never retrieved.
   */
  authorizedDocumentIds?: string[];
  similarityThreshold?: number;
}

export interface VectorStore {
  ensureCollection(): Promise<void>;
  upsertChunks(records: VectorChunkRecord[]): Promise<void>;
  deleteByDocumentIds(documentIds: string[]): Promise<void>;
  querySimilar(options: VectorQueryOptions): Promise<RetrievedChunk[]>;
  healthCheck(): Promise<boolean>;
}

const buildChromaMetadata = (
  metadata: VectorChunkMetadata
): ChromaMetadata => {
  const result: ChromaMetadata = {
    documentId: metadata.documentId,
    chunkId: metadata.chunkId,
    chunkIndex: metadata.chunkIndex,
    accessLevel: metadata.accessLevel,
    allowedDepartments: metadata.allowedDepartments,
    documentName: metadata.documentName,
  };

  if (metadata.department) {
    result.department = metadata.department;
  }

  if (typeof metadata.pageNumber === 'number') {
    result.pageNumber = metadata.pageNumber;
  }

  if (metadata.embeddingModel) {
    result.embeddingModel = metadata.embeddingModel;
  }

  return result;
};

const normalizeMetadata = (
  metadata: ChromaMetadata | null
): VectorChunkMetadata => ({
  documentId: String(metadata?.documentId ?? ''),
  chunkId: String(metadata?.chunkId ?? ''),
  chunkIndex: Number(metadata?.chunkIndex ?? 0),
  department:
    typeof metadata?.department === 'string' ? metadata.department : undefined,
  accessLevel:
    (metadata?.accessLevel as VectorChunkMetadata['accessLevel']) ??
    'restricted',
  allowedDepartments: String(metadata?.allowedDepartments ?? ''),
  documentName: String(metadata?.documentName ?? ''),
  pageNumber:
    typeof metadata?.pageNumber === 'number' ? metadata.pageNumber : undefined,
  embeddingModel:
    typeof metadata?.embeddingModel === 'string'
      ? metadata.embeddingModel
      : undefined,
});

export class ChromaVectorStore implements VectorStore {
  private readonly client: ChromaClient;
  private readonly collectionName: string;
  private collectionId?: string;

  constructor() {
    this.client = new ChromaClient(
      config.chroma.url,
      config.chroma.tenant,
      config.chroma.database
    );
    this.collectionName = config.chroma.collection;
  }

  async ensureCollection(): Promise<void> {
    if (this.collectionId) {
      return;
    }
    const collection = await this.client.getOrCreateCollection(
      this.collectionName
    );
    this.collectionId = collection.id;
  }

  private async getCollectionId(): Promise<string> {
    await this.ensureCollection();
    return this.collectionId as string;
  }

  async upsertChunks(records: VectorChunkRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }
    const collectionId = await this.getCollectionId();

    await this.client.upsert(collectionId, {
      ids: records.map((record) => record.chunkId),
      embeddings: records.map((record) => record.embedding),
      documents: records.map((record) => record.text),
      metadatas: records.map((record) => buildChromaMetadata(record.metadata)),
    });
  }

  async deleteByDocumentIds(documentIds: string[]): Promise<void> {
    if (documentIds.length === 0) {
      return;
    }
    const collectionId = await this.getCollectionId();
    await this.client.deleteRecords(collectionId, {
      where: { documentId: { $in: documentIds } },
    });
  }

  async querySimilar(options: VectorQueryOptions): Promise<RetrievedChunk[]> {
    if (
      options.authorizedDocumentIds !== undefined &&
      options.authorizedDocumentIds.length === 0
    ) {
      return [];
    }

    const collectionId = await this.getCollectionId();

    const where =
      options.authorizedDocumentIds !== undefined
        ? { documentId: { $in: options.authorizedDocumentIds } }
        : undefined;

    const result = await this.client.query(collectionId, {
      queryEmbeddings: [options.embedding],
      nResults: options.topK,
      where,
      include: ['documents', 'metadatas', 'distances'],
    });

    const chunks: RetrievedChunk[] = result.ids.map((id, index) => {
      const metadata = normalizeMetadata(result.metadatas[index] ?? null);
      return {
        chunkId: id,
        documentId: metadata.documentId,
        text: result.documents[index] ?? '',
        distance: result.distances[index] ?? Number.POSITIVE_INFINITY,
        metadata,
      };
    });

    if (options.similarityThreshold && options.similarityThreshold > 0) {
      return chunks.filter(
        (chunk) => chunk.distance <= (options.similarityThreshold as number)
      );
    }

    return chunks;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      return true;
    } catch {
      return false;
    }
  }
}

let vectorStoreInstance: VectorStore | undefined;

export const getVectorStore = (): VectorStore => {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new ChromaVectorStore();
  }
  return vectorStoreInstance;
};

export const setVectorStoreForTesting = (store: VectorStore): void => {
  vectorStoreInstance = store;
};

export type { ChromaMetadataValue };
