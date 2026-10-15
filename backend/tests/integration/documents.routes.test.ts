import path from 'path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
import { User } from '../../src/models/user.model';
import { Document as DocumentModel } from '../../src/models/document.model';
import { DocumentChunk } from '../../src/models/document-chunk.model';
import { setVectorStoreForTesting } from '../../src/integrations/vector-store/vector-store.service';
import { setEmbeddingsProviderForTesting } from '../../src/integrations/llm/embeddings.service';
import {
  DeterministicEmbeddingsProvider,
  InMemoryVectorStore,
} from '../helpers/mock-providers';

const SAMPLE_PATH = path.join(__dirname, '../fixtures/sample-knowledge.txt');
const PASSWORD = 'StrongPassword123!';

let vectorStore: InMemoryVectorStore;

beforeEach(() => {
  vectorStore = new InMemoryVectorStore();
  setVectorStoreForTesting(vectorStore);
  setEmbeddingsProviderForTesting(new DeterministicEmbeddingsProvider());
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

const uploadSample = (token: string) =>
  request(app)
    .post('/api/v1/documents/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', SAMPLE_PATH);

describe('Documents API', () => {
  describe('authorization', () => {
    it('rejects unauthenticated uploads', async () => {
      const res = await request(app)
        .post('/api/v1/documents/upload')
        .attach('file', SAMPLE_PATH);
      expect(res.status).toBe(401);
    });

    it('prevents employees from uploading documents', async () => {
      const token = await registerEmployee('emp@example.com', 'Engineering');
      const res = await uploadSample(token);
      expect(res.status).toBe(403);
    });

    it('prevents employees from deleting documents', async () => {
      const token = await registerEmployee('emp@example.com', 'Engineering');
      const res = await request(app)
        .delete('/api/v1/documents/000000000000000000000000')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/documents/upload', () => {
    it('uploads and processes a TXT document synchronously', async () => {
      const token = await createAdminToken();
      const res = await uploadSample(token);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('processed');
      expect(res.body.data.chunkCount).toBeGreaterThan(0);

      const chunks = await DocumentChunk.find({ documentId: res.body.data.id });
      expect(chunks.length).toBe(res.body.data.chunkCount);
      expect(vectorStore.count()).toBe(res.body.data.chunkCount);
    });

    it('rejects a duplicate file with 409 and creates no extra chunks', async () => {
      const token = await createAdminToken();
      await uploadSample(token);
      const res = await uploadSample(token);

      expect(res.status).toBe(409);
      expect(await DocumentModel.countDocuments()).toBe(1);
    });

    it('rejects unsupported file types with 400', async () => {
      const token = await createAdminToken();
      const res = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('binary'), {
          filename: 'malicious.exe',
          contentType: 'application/octet-stream',
        });

      expect(res.status).toBe(400);
    });

    it('rejects files exceeding the size limit with 413', async () => {
      const token = await createAdminToken();
      const res = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.alloc(20000, 'a'), {
          filename: 'big.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(413);
    });

    it('rejects an upload with no file with 400', async () => {
      const token = await createAdminToken();
      const res = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('accessLevel', 'public');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/documents', () => {
    it('shows employees only documents they are authorized to access', async () => {
      const adminToken = await createAdminToken();
      await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('accessLevel', 'public')
        .attach('file', SAMPLE_PATH);

      const restricted = Buffer.from('Secret finance planning document contents.');
      await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('accessLevel', 'restricted')
        .field('department', 'Finance')
        .field('allowedDepartments', 'Finance')
        .attach('file', restricted, {
          filename: 'finance-secret.txt',
          contentType: 'text/plain',
        });

      const engineeringToken = await registerEmployee(
        'eng@example.com',
        'Engineering'
      );
      const engineeringList = await request(app)
        .get('/api/v1/documents')
        .set('Authorization', `Bearer ${engineeringToken}`);

      expect(engineeringList.status).toBe(200);
      const names = engineeringList.body.data.documents.map(
        (doc: { name: string }) => doc.name
      );
      expect(names).toContain('sample-knowledge');
      expect(names).not.toContain('finance-secret');

      const adminList = await request(app)
        .get('/api/v1/documents')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminList.body.data.documents).toHaveLength(2);
    });
  });

  describe('GET /api/v1/documents/:id', () => {
    it('returns 404 when an employee requests a restricted document from another department', async () => {
      const adminToken = await createAdminToken();
      const uploadRes = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('accessLevel', 'restricted')
        .field('department', 'Finance')
        .field('allowedDepartments', 'Finance')
        .attach('file', Buffer.from('restricted content'), {
          filename: 'restricted.txt',
          contentType: 'text/plain',
        });

      const engineeringToken = await registerEmployee(
        'eng@example.com',
        'Engineering'
      );
      const res = await request(app)
        .get(`/api/v1/documents/${uploadRes.body.data.id}`)
        .set('Authorization', `Bearer ${engineeringToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/documents/:id', () => {
    it('removes the document, its chunks and its vectors', async () => {
      const token = await createAdminToken();
      const uploadRes = await uploadSample(token);
      expect(vectorStore.count()).toBeGreaterThan(0);

      const res = await request(app)
        .delete(`/api/v1/documents/${uploadRes.body.data.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(await DocumentModel.findById(uploadRes.body.data.id)).toBeNull();
      expect(
        await DocumentChunk.countDocuments({ documentId: uploadRes.body.data.id })
      ).toBe(0);
      expect(vectorStore.count()).toBe(0);
    });
  });
});
