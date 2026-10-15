import {
  deriveCollectionName,
  loadConfig,
  slugify,
} from '../../src/config/env';

const baseEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'development',
  BACKEND_PORT: '5000',
  MONGODB_URI: 'mongodb://localhost:27017/copilot',
  MONGODB_DATABASE: 'copilot',
  REDIS_URL: 'redis://localhost:6379',
  CHROMA_URL: 'http://localhost:8000',
  CORS_ORIGIN: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'secret',
  JWT_ACCESS_EXPIRES_IN: '15m',
  BCRYPT_ROUNDS: '10',
});

describe('config / provider validation', () => {
  it('selects Ollama without any cloud API credentials', () => {
    const config = loadConfig({
      ...baseEnv(),
      LLM_PROVIDER: 'ollama',
      EMBEDDING_PROVIDER: 'ollama',
      LLM_MODEL: 'qwen2.5:3b',
      EMBEDDING_MODEL: 'nomic-embed-text',
      OLLAMA_BASE_URL: 'http://ollama:11434',
    });

    expect(config.llm.provider).toBe('ollama');
    expect(config.llm.embeddingProvider).toBe('ollama');
    expect(config.llm.apiKey).toBe('');
    expect(config.llm.embeddingApiKey).toBe('');
    expect(config.llm.ollama.baseUrl).toBe('http://ollama:11434');
  });

  it('requires OLLAMA_BASE_URL when Ollama is selected outside of tests', () => {
    expect(() =>
      loadConfig({
        ...baseEnv(),
        LLM_PROVIDER: 'ollama',
        EMBEDDING_PROVIDER: 'ollama',
      })
    ).toThrow(/OLLAMA_BASE_URL/);
  });

  it('requires an API key for the OpenAI chat provider', () => {
    expect(() =>
      loadConfig({
        ...baseEnv(),
        LLM_PROVIDER: 'openai',
        EMBEDDING_PROVIDER: 'openai',
        EMBEDDING_API_KEY: 'sk-embed',
      })
    ).toThrow(/LLM_API_KEY/);
  });

  it('requires a key for the OpenAI embedding provider', () => {
    expect(() =>
      loadConfig({
        ...baseEnv(),
        LLM_PROVIDER: 'ollama',
        LLM_MODEL: 'qwen2.5:3b',
        EMBEDDING_PROVIDER: 'openai',
        EMBEDDING_MODEL: 'text-embedding-3-small',
        OLLAMA_BASE_URL: 'http://ollama:11434',
      })
    ).toThrow(/EMBEDDING_API_KEY/);
  });

  it('accepts OpenAI when credentials are present', () => {
    const config = loadConfig({
      ...baseEnv(),
      LLM_PROVIDER: 'openai',
      EMBEDDING_PROVIDER: 'openai',
      LLM_API_KEY: 'sk-chat',
      EMBEDDING_API_KEY: 'sk-embed',
    });

    expect(config.llm.provider).toBe('openai');
    expect(config.llm.embeddingProvider).toBe('openai');
  });

  it('does not require credentials in the test environment', () => {
    const config = loadConfig({
      ...baseEnv(),
      NODE_ENV: 'test',
      LLM_PROVIDER: 'openai',
      EMBEDDING_PROVIDER: 'openai',
    });

    expect(config.isTest).toBe(true);
    expect(config.llm.provider).toBe('openai');
  });

  it('rejects unsupported provider names', () => {
    expect(() =>
      loadConfig({
        ...baseEnv(),
        LLM_PROVIDER: 'gemini',
        LLM_API_KEY: 'x',
      })
    ).toThrow(/Unsupported LLM_PROVIDER/);

    expect(() =>
      loadConfig({
        ...baseEnv(),
        EMBEDDING_PROVIDER: 'cohere',
      })
    ).toThrow(/Unsupported EMBEDDING_PROVIDER/);
  });

  it('fails fast when a required base variable is missing', () => {
    const env = baseEnv();
    delete env.MONGODB_URI;
    expect(() => loadConfig(env)).toThrow(/Missing required environment variables/);
  });
});

describe('embedding-model collection isolation', () => {
  it('produces different collection names for different embedding models', () => {
    const openAiName = deriveCollectionName(
      'documents',
      'openai',
      'text-embedding-3-small'
    );
    const ollamaName = deriveCollectionName(
      'documents',
      'ollama',
      'nomic-embed-text'
    );

    expect(openAiName).not.toBe(ollamaName);
    expect(openAiName).toBe('documents__openai-text-embedding-3-small');
    expect(ollamaName).toBe('documents__ollama-nomic-embed-text');
  });

  it('derives the active collection from the configured embedding provider/model', () => {
    const ollamaConfig = loadConfig({
      ...baseEnv(),
      LLM_PROVIDER: 'ollama',
      EMBEDDING_PROVIDER: 'ollama',
      EMBEDDING_MODEL: 'nomic-embed-text',
      OLLAMA_BASE_URL: 'http://ollama:11434',
    });
    const openAiConfig = loadConfig({
      ...baseEnv(),
      LLM_PROVIDER: 'openai',
      EMBEDDING_PROVIDER: 'openai',
      EMBEDDING_MODEL: 'text-embedding-3-small',
      LLM_API_KEY: 'sk-chat',
      EMBEDDING_API_KEY: 'sk-embed',
    });

    expect(ollamaConfig.chroma.collection).toBe(
      'documents__ollama-nomic-embed-text'
    );
    expect(openAiConfig.chroma.collection).toBe(
      'documents__openai-text-embedding-3-small'
    );
    expect(ollamaConfig.chroma.collection).not.toBe(openAiConfig.chroma.collection);
  });

  it('slugifies model names safely', () => {
    expect(slugify('Nomic Embed Text!')).toBe('nomic-embed-text');
  });
});
