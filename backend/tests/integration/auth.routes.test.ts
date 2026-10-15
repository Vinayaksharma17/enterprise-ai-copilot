import request from 'supertest';
import app from '../../src/app';
import { User } from '../../src/models/user.model';

describe('Auth Routes', () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.BCRYPT_ROUNDS = '10';
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register an employee successfully', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
        department: 'Engineering',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('employee');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should reject duplicate email', async () => {
      await request(app).post('/api/v1/auth/register').send({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Another',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid email', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test Employee',
        email: 'invalid-email',
        password: 'StrongPassword123!',
      });

      expect(res.status).toBe(400);
    });

    it('should reject weak password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'weak',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });
    });

    it('should login successfully', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject wrong password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'employee@example.com',
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
    });

    it('should reject unknown email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'unknown@example.com',
        password: 'StrongPassword123!',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const registerRes = await request(app).post('/api/v1/auth/register').send({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });

      const token = registerRes.body.data.token;
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('employee@example.com');
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });
});
