import path from 'path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
import { User } from '../../src/models/user.model';
import { Message } from '../../src/models/message.model';
import { setVectorStoreForTesting } from '../../src/integrations/vector-store/vector-store.service';
import { setEmbeddingsProviderForTesting } from '../../src/integrations/llm/embeddings.service';
import { setChatProviderForTesting } from '../../src/integrations/llm/llm.service';
import {
  MODEL_UNAVAILABLE_MESSAGE,
  NO_ANSWER_MESSAGE,
} from '../../src/modules/chat/chat.service';
import {
  DeterministicEmbeddingsProvider,
  InMemoryVectorStore,
  createMockChatProvider,
} from '../helpers/mock-providers';

const SAMPLE_PATH = path.join(__dirname, '../fixtures/sample-knowledge.txt');
const PASSWORD = 'StrongPassword123!';
const GROUNDED_ANSWER =
  'Employees may work remotely up to three days per week with manager approval.';

let vectorStore: InMemoryVectorStore;
let chatProvider: ReturnType<typeof createMockChatProvider>;

beforeEach(() => {
  vectorStore = new InMemoryVectorStore();
  setVectorStoreForTesting(vectorStore);
  setEmbeddingsProviderForTesting(new DeterministicEmbeddingsProvider());
  chatProvider = createMockChatProvider(GROUNDED_ANSWER);
  setChatProviderForTesting(chatProvider);
});

const registerEmployee = async (
  email: string,
  department?: string
): Promise<string> => {
  const res = await request(app).post('/api/v1/auth/register').send({
    name: 'Employee',
    email,
    password: PASSWORD,
    department,
  });
  return res.body.data.token as string;
};

const createAdminToken = async (email = 'admin@example.com'): Promise<string> => {
  const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
  await User.create({
    name: 'Admin',
    email,
    passwordHash,
    role: 'admin',
    department: 'Admin',
    isActive: true,
  });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'AdminPassword123!' });
  return res.body.data.token as string;
};

const uploadKnowledge = async (token: string): Promise<string> => {
  const res = await request(app)
    .post('/api/v1/documents/upload')
    .set('Authorization', `Bearer ${token}`)
    .field('accessLevel', 'public')
    .attach('file', SAMPLE_PATH);
  return res.body.data.id as string;
};

const ask = (token: string, body: Record<string, unknown>) =>
  request(app)
    .post('/api/v1/chat')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

describe('RAG Chat API', () => {
  it('answers a question grounded in the uploaded document with citations', async () => {
    const adminToken = await createAdminToken();
    await uploadKnowledge(adminToken);
    const employeeToken = await registerEmployee('eng@example.com', 'Engineering');

    const res = await ask(employeeToken, {
      question: 'What is the remote work policy?',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toBe(GROUNDED_ANSWER);
    expect(res.body.data.conversationId).toBeDefined();
    expect(res.body.data.sources.length).toBeGreaterThan(0);

    const source = res.body.data.sources[0];
    expect(source.documentName).toBe('sample-knowledge');
    expect(source.chunkId).toBeDefined();
    expect(source.excerpt.toLowerCase()).toContain('remote');
    // TXT documents have no page numbers; none must be fabricated.
    expect(source.pageNumber).toBeUndefined();
  });

  it('passes the retrieved evidence to the LLM', async () => {
    const adminToken = await createAdminToken();
    await uploadKnowledge(adminToken);
    const employeeToken = await registerEmployee('eng@example.com', 'Engineering');

    await ask(employeeToken, { question: 'What is the remote work policy?' });

    expect(chatProvider.generate).toHaveBeenCalledTimes(1);
    const messages = chatProvider.generate.mock.calls[0][0];
    const userMessage = messages[messages.length - 1];
    expect(userMessage.content).toContain('Retrieved evidence');
    expect(userMessage.content).toContain('What is the remote work policy?');
    expect(userMessage.content.toLowerCase()).toContain('remote');
  });

  it('returns the no-answer message and does not call the LLM when there is no evidence', async () => {
    const adminToken = await createAdminToken();
    await uploadKnowledge(adminToken);
    const employeeToken = await registerEmployee('eng@example.com', 'Engineering');

    const res = await ask(employeeToken, {
      question: 'What is the capital of France?',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.answer).toBe(NO_ANSWER_MESSAGE);
    expect(res.body.data.sources).toEqual([]);
    expect(chatProvider.generate).not.toHaveBeenCalled();
  });

  it('returns no citations when the model declines despite retrieved evidence', async () => {
    const adminToken = await createAdminToken();
    await uploadKnowledge(adminToken);
    const employeeToken = await registerEmployee('eng@example.com', 'Engineering');

    setChatProviderForTesting(createMockChatProvider(NO_ANSWER_MESSAGE));

    const res = await ask(employeeToken, {
      question: 'What is the remote work policy?',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.answer).toBe(NO_ANSWER_MESSAGE);
    expect(res.body.data.sources).toEqual([]);
    expect(await Message.countDocuments({ role: 'assistant', 'sources.0': { $exists: true } })).toBe(0);
  });

  it('never retrieves chunks from restricted documents the user cannot access', async () => {
    const adminToken = await createAdminToken();
    await uploadKnowledge(adminToken);

    const financeSecret = Buffer.from(
      'The quarterly finance budget for project falcon is 250000 dollars.'
    );
    await request(app)
      .post('/api/v1/documents/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('accessLevel', 'restricted')
      .field('department', 'Finance')
      .field('allowedDepartments', 'Finance')
      .attach('file', financeSecret, {
        filename: 'finance-budget.txt',
        contentType: 'text/plain',
      });

    const engineeringToken = await registerEmployee('eng@example.com', 'Engineering');
    const res = await ask(engineeringToken, {
      question: 'What is the budget for project falcon?',
    });

    expect(res.body.data.answer).toBe(NO_ANSWER_MESSAGE);
    expect(res.body.data.sources).toEqual([]);
    expect(chatProvider.generate).not.toHaveBeenCalled();
  });

  it('allows an authorized department to retrieve restricted documents', async () => {
    const adminToken = await createAdminToken();
    const financeSecret = Buffer.from(
      'The quarterly finance budget for project falcon is 250000 dollars.'
    );
    await request(app)
      .post('/api/v1/documents/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('accessLevel', 'restricted')
      .field('department', 'Finance')
      .field('allowedDepartments', 'Finance')
      .attach('file', financeSecret, {
        filename: 'finance-budget.txt',
        contentType: 'text/plain',
      });

    const financeToken = await registerEmployee('finance@example.com', 'Finance');
    const res = await ask(financeToken, {
      question: 'What is the budget for project falcon?',
    });

    expect(res.body.data.sources.length).toBeGreaterThan(0);
    expect(res.body.data.sources[0].documentName).toBe('finance-budget');
  });

  it('persists conversations and messages and supports follow-ups', async () => {
    const adminToken = await createAdminToken();
    await uploadKnowledge(adminToken);
    const employeeToken = await registerEmployee('eng@example.com', 'Engineering');

    const first = await ask(employeeToken, {
      question: 'What is the remote work policy?',
    });
    const conversationId = first.body.data.conversationId;

    const second = await ask(employeeToken, {
      question: 'How many days per week may employees work remotely?',
      conversationId,
    });

    expect(second.body.data.conversationId).toBe(conversationId);
    const messages = await Message.find({ conversationId }).sort({
      createdAt: 1,
      _id: 1,
    });
    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].sources.length).toBeGreaterThan(0);
  });

  it("rejects access to another user's conversation", async () => {
    const adminToken = await createAdminToken();
    await uploadKnowledge(adminToken);

    const userA = await registerEmployee('a@example.com', 'Engineering');
    const userB = await registerEmployee('b@example.com', 'Engineering');

    const first = await ask(userA, { question: 'What is the remote work policy?' });
    const conversationId = first.body.data.conversationId;

    const res = await ask(userB, {
      question: 'What is the remote work policy?',
      conversationId,
    });

    expect(res.status).toBe(404);
  });

  it('rejects malformed chat requests with 400', async () => {
    const employeeToken = await registerEmployee('eng@example.com', 'Engineering');
    const res = await ask(employeeToken, { question: '' });
    expect(res.status).toBe(400);
  });

  it('returns a safe 503 and no fabricated citations when the chat model fails', async () => {
    const adminToken = await createAdminToken();
    await uploadKnowledge(adminToken);
    const employeeToken = await registerEmployee('eng@example.com', 'Engineering');

    setChatProviderForTesting({
      generate: jest
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED http://ollama:11434')),
    });

    const res = await ask(employeeToken, {
      question: 'What is the remote work policy?',
    });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.message).toBe(MODEL_UNAVAILABLE_MESSAGE);
    // The internal provider error must not leak to the client.
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    // A failed generation must not persist a fabricated answer or citations.
    expect(await Message.countDocuments({})).toBe(0);
  });

  it('returns a safe 503 when the embedding model fails', async () => {
    const adminToken = await createAdminToken();
    await uploadKnowledge(adminToken);
    const employeeToken = await registerEmployee('eng@example.com', 'Engineering');

    setEmbeddingsProviderForTesting({
      embedDocuments: jest.fn(),
      embedQuery: jest
        .fn()
        .mockRejectedValue(new Error('fetch failed to http://ollama:11434')),
    });

    const res = await ask(employeeToken, {
      question: 'What is the remote work policy?',
    });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.message).toBe(MODEL_UNAVAILABLE_MESSAGE);
    expect(await Message.countDocuments({})).toBe(0);
  });
});
