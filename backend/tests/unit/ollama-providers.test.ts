import { config } from '../../src/config/env';

const mockChatInvoke = jest.fn();
const mockEmbedDocuments = jest.fn();
const mockEmbedQuery = jest.fn();

jest.mock('@langchain/ollama', () => ({
  ChatOllama: jest.fn(() => ({ invoke: mockChatInvoke })),
  OllamaEmbeddings: jest.fn(() => ({
    embedDocuments: mockEmbedDocuments,
    embedQuery: mockEmbedQuery,
  })),
}));

// Imported after the mock so the provider classes pick up the mock constructor.
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { OllamaChatProvider } from '../../src/integrations/llm/ollama.chat';
import { OllamaEmbeddingsProvider } from '../../src/integrations/llm/ollama.embeddings';

const ChatOllamaMock = ChatOllama as unknown as jest.Mock;
const OllamaEmbeddingsMock = OllamaEmbeddings as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OllamaChatProvider', () => {
  it('initializes the chat model with the configured model and base URL', () => {
    new OllamaChatProvider();

    expect(ChatOllamaMock).toHaveBeenCalledTimes(1);
    const args = ChatOllamaMock.mock.calls[0][0];
    expect(args.model).toBe(config.llm.model);
    expect(args.baseUrl).toBe(config.llm.ollama.baseUrl);
    expect(args.numCtx).toBe(config.llm.ollama.numCtx);
    // Model auto-pulling must stay disabled so weights are never downloaded at
    // request time.
    expect(args.checkOrPullModel).toBe(false);
  });

  it('returns the generated answer', async () => {
    mockChatInvoke.mockResolvedValue({ content: 'Grounded answer.' });
    const provider = new OllamaChatProvider();

    const answer = await provider.generate([
      { role: 'user', content: 'What is the policy?' },
    ]);

    expect(answer).toBe('Grounded answer.');
  });

  it('flattens structured content parts', async () => {
    mockChatInvoke.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }],
    });
    const provider = new OllamaChatProvider();

    const answer = await provider.generate([{ role: 'user', content: 'hi' }]);

    expect(answer).toBe('Hello world');
  });

  it('propagates an unavailability error without retrying non-transient failures', async () => {
    mockChatInvoke.mockRejectedValue(new Error('model "qwen2.5:3b" not found'));
    const provider = new OllamaChatProvider();

    await expect(
      provider.generate([{ role: 'user', content: 'hi' }])
    ).rejects.toThrow('not found');
    expect(mockChatInvoke).toHaveBeenCalledTimes(1);
  });
});

describe('OllamaEmbeddingsProvider', () => {
  it('initializes the embedding model with the configured model and base URL', () => {
    new OllamaEmbeddingsProvider();

    expect(OllamaEmbeddingsMock).toHaveBeenCalledTimes(1);
    const args = OllamaEmbeddingsMock.mock.calls[0][0];
    expect(args.model).toBe(config.llm.embeddingModel);
    expect(args.baseUrl).toBe(config.llm.ollama.baseUrl);
  });

  it('uses the same provider/model for document and query embeddings', async () => {
    mockEmbedDocuments.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mockEmbedQuery.mockResolvedValue([0.1, 0.2, 0.3]);
    const provider = new OllamaEmbeddingsProvider();

    const docs = await provider.embedDocuments(['a chunk of text']);
    const query = await provider.embedQuery('a query');

    expect(docs).toEqual([[0.1, 0.2, 0.3]]);
    expect(query).toEqual([0.1, 0.2, 0.3]);
    // Both entry points must use the single configured model instance.
    expect(OllamaEmbeddingsMock).toHaveBeenCalledTimes(1);
    expect(OllamaEmbeddingsMock.mock.calls[0][0].model).toBe(
      config.llm.embeddingModel
    );
  });

  it('returns an empty array for empty input without calling the model', async () => {
    const provider = new OllamaEmbeddingsProvider();
    expect(await provider.embedDocuments([])).toEqual([]);
    expect(mockEmbedDocuments).not.toHaveBeenCalled();
  });

  it('propagates embedding failures', async () => {
    mockEmbedQuery.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const provider = new OllamaEmbeddingsProvider();

    await expect(provider.embedQuery('hi')).rejects.toThrow('ECONNREFUSED');
  });
});
