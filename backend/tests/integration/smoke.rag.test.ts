/**
 * Optional end-to-end smoke test against REAL providers.
 *
 * It is skipped by default so the standard suite never requires paid
 * credentials or running infrastructure. To run it:
 *
 *   RUN_SMOKE_TESTS=true \
 *   CHROMA_URL=http://localhost:8000 \
 *   LLM_API_KEY=sk-... \
 *   EMBEDDING_API_KEY=sk-... \
 *   npm test -- smoke.rag
 *
 * Requires a reachable ChromaDB instance and valid provider credentials.
 */
import path from 'path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
import { User } from '../../src/models/user.model';

const shouldRun = process.env.RUN_SMOKE_TESTS === 'true';
const describeSmoke = shouldRun ? describe : describe.skip;

const SAMPLE_PATH = path.join(__dirname, '../fixtures/sample-knowledge.txt');

describeSmoke('RAG smoke test (real ChromaDB + provider APIs)', () => {
  it('indexes a document and answers with a grounded citation', async () => {
    const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
    await User.create({
      name: 'Admin',
      email: 'smoke-admin@example.com',
      passwordHash,
      role: 'admin',
      department: 'Admin',
      isActive: true,
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'smoke-admin@example.com', password: 'AdminPassword123!' });
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
    expect(unrelated.body.data.sources).toEqual([]);
  }, 120000);
});
