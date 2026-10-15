/**
 * Minimal ChromaDB REST client targeting the stable v1 HTTP API exposed by
 * Chroma server 0.5.x (the version used in docker-compose).
 *
 * A thin fetch-based client is used deliberately: the official `chromadb` npm
 * client ships heavy native dependencies (`@xenova/transformers`,
 * `onnxruntime`, image canvas) that are problematic on Alpine-based images,
 * while this backend only ever supplies pre-computed embeddings and therefore
 * needs a very small slice of the API. It also gives us explicit control over
 * metadata filters and idempotent id-based upserts.
 */

export type ChromaMetadataValue = string | number | boolean;
export type ChromaMetadata = Record<string, ChromaMetadataValue>;

export interface ChromaQueryRequest {
  queryEmbeddings: number[][];
  nResults: number;
  where?: Record<string, unknown>;
  include?: string[];
}

export interface ChromaQueryResult {
  ids: string[];
  distances: number[];
  documents: (string | null)[];
  metadatas: (ChromaMetadata | null)[];
}

export interface ChromaUpsertRecord {
  ids: string[];
  embeddings: number[][];
  documents: string[];
  metadatas: ChromaMetadata[];
}

export interface ChromaCollection {
  id: string;
  name: string;
}

const DEFAULT_TENANT = 'default_tenant';
const DEFAULT_DATABASE = 'default_database';

export class ChromaClient {
  private readonly baseUrl: string;
  private readonly tenant: string;
  private readonly database: string;

  constructor(
    baseUrl: string,
    tenant: string = DEFAULT_TENANT,
    database: string = DEFAULT_DATABASE
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.tenant = tenant;
    this.database = database;
  }

  private buildUrl(path: string, query?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      Object.entries(query).forEach(([key, value]) =>
        url.searchParams.set(key, value)
      );
    }
    return url.toString();
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    query?: Record<string, string>
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.buildUrl(path, query), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });
    } catch (error) {
      throw new Error(
        `Unable to reach ChromaDB at ${this.baseUrl}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }

    const rawBody = await response.text();

    if (!response.ok) {
      throw new Error(
        `ChromaDB request failed (${response.status} ${response.statusText}): ${rawBody.slice(0, 500)}`
      );
    }

    if (!rawBody) {
      return undefined as T;
    }

    try {
      return JSON.parse(rawBody) as T;
    } catch {
      return rawBody as unknown as T;
    }
  }

  private tenantQuery(): Record<string, string> {
    return { tenant: this.tenant, database: this.database };
  }

  async heartbeat(): Promise<number> {
    const body = await this.request<{ 'nanosecond heartbeat': number }>(
      '/api/v1/heartbeat',
      { method: 'GET' }
    );
    return body?.['nanosecond heartbeat'];
  }

  async getOrCreateCollection(name: string): Promise<ChromaCollection> {
    const body = await this.request<{ id: string; name: string }>(
      '/api/v1/collections',
      {
        method: 'POST',
        body: JSON.stringify({ name, get_or_create: true }),
      },
      this.tenantQuery()
    );
    return { id: body.id, name: body.name };
  }

  async getCollection(name: string): Promise<ChromaCollection | null> {
    try {
      const body = await this.request<{ id: string; name: string }>(
        `/api/v1/collections/${encodeURIComponent(name)}`,
        { method: 'GET' },
        this.tenantQuery()
      );
      return { id: body.id, name: body.name };
    } catch {
      return null;
    }
  }

  async deleteCollection(name: string): Promise<void> {
    await this.request<void>(
      `/api/v1/collections/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
      this.tenantQuery()
    );
  }

  async upsert(
    collectionId: string,
    record: ChromaUpsertRecord
  ): Promise<void> {
    await this.request<void>(
      `/api/v1/collections/${encodeURIComponent(collectionId)}/upsert`,
      { method: 'POST', body: JSON.stringify(record) }
    );
  }

  async deleteRecords(
    collectionId: string,
    filter: { ids?: string[]; where?: Record<string, unknown> }
  ): Promise<void> {
    await this.request<void>(
      `/api/v1/collections/${encodeURIComponent(collectionId)}/delete`,
      { method: 'POST', body: JSON.stringify(filter) }
    );
  }

  async query(
    collectionId: string,
    request: ChromaQueryRequest
  ): Promise<ChromaQueryResult> {
    const body = await this.request<{
      ids?: string[][];
      distances?: number[][];
      documents?: (string | null)[][];
      metadatas?: (ChromaMetadata | null)[][];
    }>(
      `/api/v1/collections/${encodeURIComponent(collectionId)}/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          query_embeddings: request.queryEmbeddings,
          n_results: request.nResults,
          where: request.where,
          include: request.include ?? ['documents', 'metadatas', 'distances'],
        }),
      }
    );

    return {
      ids: body.ids?.[0] ?? [],
      distances: body.distances?.[0] ?? [],
      documents: body.documents?.[0] ?? [],
      metadatas: body.metadatas?.[0] ?? [],
    };
  }
}
