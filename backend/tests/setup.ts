import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Set required env vars for tests
process.env.NODE_ENV = 'test';
process.env.BACKEND_PORT = '5000';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.MONGODB_DATABASE = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.JWT_ACCESS_SECRET = 'test-secret-key-for-testing';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.BCRYPT_ROUNDS = '10';

// Document ingestion / RAG settings for tests
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eac-uploads-'));
process.env.MAX_FILE_SIZE_BYTES = '8192';
process.env.CHUNK_SIZE = '400';
process.env.CHUNK_OVERLAP = '50';
process.env.RAG_TOP_K = '5';
process.env.RAG_SIMILARITY_THRESHOLD = '0';
process.env.RAG_MAX_HISTORY_MESSAGES = '6';
process.env.LLM_PROVIDER = 'openai';
process.env.LLM_MODEL = 'gpt-4o-mini';
process.env.EMBEDDING_MODEL = 'text-embedding-3-small';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri;
  await mongoose.connect(mongoUri);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
}, 60000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
