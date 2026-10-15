/**
 * Optional end-to-end integration test against a REAL local Ollama runtime and
 * a REAL ChromaDB instance. It is skipped by default so the standard suite
 * never requires running services or downloaded models.
 *
 * Prerequisites:
 *   - Ollama running and reachable at OLLAMA_BASE_URL (default http://localhost:11434)
 *   - Models pulled:  ollama pull qwen2.5:3b ; ollama pull nomic-embed-text
 *   - ChromaDB reachable at CHROMA_URL
 *
 * Run with:
 *   RUN_OLLAMA_TESTS=true \
 *   LLM_PROVIDER=ollama EMBEDDING_PROVIDER=ollama \
 *   OLLAMA_BASE_URL=http://localhost:11434 \
 *   CHROMA_URL=http://localhost:8000 \
 *   npm test -- ollama.rag
 */
import path from 'path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
import { config } from '../../src/config/env';
import { User } from '../../src/models/user.model';
import { NO_ANSWER_MESSAGE } from '../../src/modules/chat/chat.service';

const shouldRun =
  process.env.RUN_OLLAMA_TESTS === 'true' && config.llm.provider === 'ollama';
const describeOllama = shouldRun ? describe : describe.skip;

const SAMPLE_PATH = path.join(__dirname, '../fixtures/sample-knowledge.txt');

describeOllama('RAG with real local Ollama models', () => {
  it('indexes with local embeddings and answers using the local chat model', async () => {
    const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
    await User.create({
      name: 'Admin',
      email: 'ollama-admin@example.com',
      passwordHash,
      role: 'admin',
      department: 'Admin',
      isActive: true,
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ollama-admin@example.com', password: 'AdminPassword123!' });
    const token = login.body.data.token as string;

    const upload = await request(app)
      .post('/api/v1/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('accessLevel', 'public')
      .attach('file', SAMPLE_PATH);

    expect(upload.status).toBe(201);
    expect(upload.body.data.status).toBe('processed');
    expect(upload.body.data.chunkCount).toBeGreaterThan(0);

    const answer = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What is the remote work policy?' });

    expect(answer.status).toBe(200);
    expect(answer.body.data.answer).toBeTruthy();
    expect(answer.body.data.sources.length).toBeGreaterThan(0);
    expect(answer.body.data.sources[0].documentName).toBe('sample-knowledge');

    const unrelated = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What is the capital of France?' });

    expect(unrelated.status).toBe(200);
    expect(unrelated.body.data.answer).toBe(NO_ANSWER_MESSAGE);
    expect(unrelated.body.data.sources).toEqual([]);
  }, 300000);
});
