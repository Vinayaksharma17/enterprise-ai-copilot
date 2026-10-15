import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'NODE_ENV',
  'BACKEND_PORT',
  'MONGODB_URI',
  'MONGODB_DATABASE',
  'REDIS_URL',
  'CHROMA_URL',
  'CORS_ORIGIN',
  'JWT_ACCESS_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'BCRYPT_ROUNDS',
];

const SUPPORTED_PROVIDERS = ['openai', 'ollama'] as const;
export type LlmProvider = (typeof SUPPORTED_PROVIDERS)[number];

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFloat = (value: string | undefined, fallback: number): number => {
  const parsed = parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Lowercases a value and replaces every non-alphanumeric run with a single
 * dash, producing a safe fragment for a ChromaDB collection name.
 */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Derives a ChromaDB collection name that is unique per embedding provider and
 * model. Vectors produced by different embedding models have different
 * dimensions and meanings, so they must never share a collection. Encoding the
 * provider and model into the name guarantees isolation and makes a re-index
 * (new collection) the explicit migration path between models.
 */
export const deriveCollectionName = (
  base: string,
  provider: string,
  model: string
): string => `${base}__${provider}-${slugify(model)}`;

export interface AppConfig {
  nodeEnv: string;
  isTest: boolean;
  port: number;
  mongodb: { uri: string; database: string };
  redis: { url: string };
  chroma: {
    url: string;
    /** Base collection name (before the embedding-model suffix). */
    baseCollection: string;
    /** Fully qualified, embedding-model-specific collection name in use. */
    collection: string;
    tenant: string;
    database: string;
  };
  cors: { origin: string };
  jwt: { secret: string; expiresIn: string };
  bcrypt: { rounds: number };
  upload: {
    dir: string;
    maxFileSizeBytes: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
  };
  chunking: { chunkSize: number; chunkOverlap: number };
  rag: {
    topK: number;
    similarityThreshold: number;
    maxHistoryMessages: number;
  };
  llm: {
    provider: LlmProvider;
    embeddingProvider: LlmProvider;
    apiKey: string;
    baseUrl: string | undefined;
    model: string;
    temperature: number;
    embeddingApiKey: string;
    embeddingBaseUrl: string | undefined;
    embeddingModel: string;
    ollama: {
      baseUrl: string;
      timeoutMs: number;
      maxConcurrency: number;
      maxQueue: number;
      retries: number;
      keepAlive: string;
      numCtx: number;
      numPredict: number;
    };
  };
}

/**
 * Validates the raw environment and produces the runtime configuration. Throws
 * with a clear message when a required variable or provider credential is
 * missing. Kept as a pure function so it can be unit tested against arbitrary
 * environments.
 */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const missingEnvVars = requiredEnvVars.filter((key) => !env[key]);
  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
  }

  const nodeEnv = env.NODE_ENV as string;
  const isTest = nodeEnv === 'test';

  const llmProvider = (env.LLM_PROVIDER || 'openai').toLowerCase() as LlmProvider;
  const embeddingProvider = (env.EMBEDDING_PROVIDER ||
    llmProvider) as LlmProvider;

  for (const [name, provider] of [
    ['LLM_PROVIDER', llmProvider],
    ['EMBEDDING_PROVIDER', embeddingProvider],
  ] as const) {
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new Error(
        `Unsupported ${name} "${provider}". Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`
      );
    }
  }

  // Credential validation is provider-specific: local (ollama) inference needs
  // no API keys, while cloud (openai) inference does. This runs outside of
  // tests so a real deployment fails fast on misconfiguration, but tests can
  // exercise either provider without secrets.
  if (!isTest) {
    if (llmProvider === 'openai' && !env.LLM_API_KEY) {
      throw new Error('LLM_API_KEY is required when LLM_PROVIDER is "openai"');
    }
    if (
      embeddingProvider === 'openai' &&
      !env.EMBEDDING_API_KEY &&
      !env.LLM_API_KEY
    ) {
      throw new Error(
        'EMBEDDING_API_KEY (or LLM_API_KEY) is required when EMBEDDING_PROVIDER is "openai"'
      );
    }
    if (
      (llmProvider === 'ollama' || embeddingProvider === 'ollama') &&
      !env.OLLAMA_BASE_URL
    ) {
      throw new Error(
        'OLLAMA_BASE_URL is required when the LLM or embedding provider is "ollama"'
      );
    }
  }

  const embeddingModel = env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const baseCollection = env.CHROMA_COLLECTION || 'documents';

  return {
    nodeEnv,
    isTest,
    port: parseInt(env.BACKEND_PORT as string, 10),
    mongodb: {
      uri: env.MONGODB_URI as string,
      database: env.MONGODB_DATABASE as string,
    },
    redis: {
      url: env.REDIS_URL as string,
    },
    chroma: {
      url: env.CHROMA_URL as string,
      baseCollection,
      collection: deriveCollectionName(
        baseCollection,
        embeddingProvider,
        embeddingModel
      ),
      tenant: env.CHROMA_TENANT || 'default_tenant',
      database: env.CHROMA_DATABASE || 'default_database',
    },
    cors: {
      origin: env.CORS_ORIGIN as string,
    },
    jwt: {
      secret: env.JWT_ACCESS_SECRET as string,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as string,
    },
    bcrypt: {
      rounds: parseInt(env.BCRYPT_ROUNDS as string, 10),
    },
    upload: {
      dir: env.UPLOAD_DIR || './uploads',
      maxFileSizeBytes: toInt(env.MAX_FILE_SIZE_BYTES, 10 * 1024 * 1024),
      allowedMimeTypes: ['application/pdf', 'text/plain'] as string[],
      allowedExtensions: ['.pdf', '.txt'] as string[],
    },
    chunking: {
      chunkSize: toInt(env.CHUNK_SIZE, 1000),
      chunkOverlap: toInt(env.CHUNK_OVERLAP, 150),
    },
    rag: {
      topK: toInt(env.RAG_TOP_K, 5),
      // Chroma returns distances (lower = more similar). A value of 0 disables
      // threshold filtering.
      similarityThreshold: toFloat(env.RAG_SIMILARITY_THRESHOLD, 0),
      maxHistoryMessages: toInt(env.RAG_MAX_HISTORY_MESSAGES, 6),
    },
    llm: {
      provider: llmProvider,
      embeddingProvider,
      apiKey: env.LLM_API_KEY || '',
      baseUrl: env.LLM_BASE_URL || undefined,
      model: env.LLM_MODEL || 'gpt-4o-mini',
      temperature: toFloat(env.LLM_TEMPERATURE, 0),
      embeddingApiKey: env.EMBEDDING_API_KEY || env.LLM_API_KEY || '',
      embeddingBaseUrl: env.EMBEDDING_BASE_URL || env.LLM_BASE_URL || undefined,
      embeddingModel,
      ollama: {
        baseUrl: env.OLLAMA_BASE_URL || 'http://localhost:11434',
        timeoutMs: toInt(env.OLLAMA_TIMEOUT_MS, 120000),
        maxConcurrency: toInt(env.OLLAMA_MAX_CONCURRENCY, 2),
        maxQueue: toInt(env.OLLAMA_MAX_QUEUE, 16),
        retries: toInt(env.OLLAMA_RETRIES, 2),
        keepAlive: env.OLLAMA_KEEP_ALIVE || '5m',
        numCtx: toInt(env.OLLAMA_NUM_CTX, 4096),
        numPredict: toInt(env.OLLAMA_NUM_PREDICT, 512),
      },
    },
  };
};

export const config: AppConfig = loadConfig();
