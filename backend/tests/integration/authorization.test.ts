import request from 'supertest';
import app from '../../src/app';
import { User } from '../../src/models/user.model';
import bcrypt from 'bcryptjs';

describe('Authorization', () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.BCRYPT_ROUNDS = '10';
  });

  it('should allow admin to access admin endpoint', async () => {
    const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
    await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash,
      role: 'admin',
      isActive: true,
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@example.com',
      password: 'AdminPassword123!',
    });

    const token = loginRes.body.data.token;
    const res = await request(app).get('/api/v1/admin/health').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should block employee from admin endpoint', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Employee',
      email: 'employee@example.com',
      password: 'StrongPassword123!',
    });

    const token = registerRes.body.data.token;
    const res = await request(app).get('/api/v1/admin/health').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/admin/health');
    expect(res.status).toBe(401);
  });
});
