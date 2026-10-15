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

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFloat = (value: string | undefined, fallback: number): number => {
  const parsed = parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeEnv = process.env.NODE_ENV as string;
const isTest = nodeEnv === 'test';

const llmProvider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
const embeddingProvider = (
  process.env.EMBEDDING_PROVIDER || llmProvider
).toLowerCase();
const supportedProviders = ['openai'];

for (const [name, provider] of [
  ['LLM_PROVIDER', llmProvider],
  ['EMBEDDING_PROVIDER', embeddingProvider],
] as const) {
  if (!supportedProviders.includes(provider)) {
    throw new Error(
      `Unsupported ${name} "${provider}". Supported providers: ${supportedProviders.join(', ')}`
    );
  }
}

// Validate provider credentials at startup for real (non-test) runs. Tests use
// mocked providers and deterministic fixtures, so credentials are optional there.
if (!isTest) {
  const credentialVars = ['LLM_API_KEY', 'EMBEDDING_API_KEY'];
  const missingCredentials = credentialVars.filter((key) => !process.env[key]);
  if (missingCredentials.length > 0) {
    throw new Error(
      `Missing required provider credentials: ${missingCredentials.join(', ')}`
    );
  }
}

export const config = {
  nodeEnv,
  isTest,
  port: parseInt(process.env.BACKEND_PORT as string, 10),
  mongodb: {
    uri: process.env.MONGODB_URI as string,
    database: process.env.MONGODB_DATABASE as string,
  },
  redis: {
    url: process.env.REDIS_URL as string,
  },
  chroma: {
    url: process.env.CHROMA_URL as string,
    collection: process.env.CHROMA_COLLECTION || 'documents',
    tenant: process.env.CHROMA_TENANT || 'default_tenant',
    database: process.env.CHROMA_DATABASE || 'default_database',
  },
  cors: {
    origin: process.env.CORS_ORIGIN as string,
  },
  jwt: {
    secret: process.env.JWT_ACCESS_SECRET as string,
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN as string,
  },
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS as string, 10),
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSizeBytes: toInt(process.env.MAX_FILE_SIZE_BYTES, 10 * 1024 * 1024),
    allowedMimeTypes: [
      'application/pdf',
      'text/plain',
    ] as string[],
    allowedExtensions: ['.pdf', '.txt'] as string[],
  },
  chunking: {
    chunkSize: toInt(process.env.CHUNK_SIZE, 1000),
    chunkOverlap: toInt(process.env.CHUNK_OVERLAP, 150),
  },
  rag: {
    topK: toInt(process.env.RAG_TOP_K, 5),
    // Chroma returns distances (lower = more similar). A value of 0 disables
    // threshold filtering. Only enable once the exact distance semantics for the
    // selected integration are understood.
    similarityThreshold: toFloat(process.env.RAG_SIMILARITY_THRESHOLD, 0),
    maxHistoryMessages: toInt(process.env.RAG_MAX_HISTORY_MESSAGES, 6),
  },
  llm: {
    provider: llmProvider,
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: process.env.LLM_BASE_URL || undefined,
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    temperature: toFloat(process.env.LLM_TEMPERATURE, 0),
    embeddingProvider,
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    embeddingApiKey:
      process.env.EMBEDDING_API_KEY || process.env.LLM_API_KEY || '',
    embeddingBaseUrl:
      process.env.EMBEDDING_BASE_URL || process.env.LLM_BASE_URL || undefined,
  },
};
