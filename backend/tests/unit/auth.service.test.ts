import mongoose from 'mongoose';
import { authService } from '../../src/services/auth.service';
import { User } from '../../src/models/user.model';

describe('AuthService', () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.BCRYPT_ROUNDS = '10';
  });

  describe('register', () => {
    it('should successfully register an employee', async () => {
      const result = await authService.register({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
        department: 'Engineering',
      });

      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('employee@example.com');
      expect(result.user.role).toBe('employee');
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('should hash password before storing', async () => {
      await authService.register({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });

      const user = await User.findOne({ email: 'employee@example.com' }).select('+passwordHash');
      expect(user).toBeDefined();
      expect(user!.passwordHash).not.toBe('StrongPassword123!');
    });

    it('should reject duplicate email', async () => {
      await authService.register({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });

      await expect(
        authService.register({
          name: 'Another',
          email: 'employee@example.com',
          password: 'StrongPassword123!',
        })
      ).rejects.toThrow('Email already exists');
    });

    it('should not return password hash', async () => {
      const result = await authService.register({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should default to employee role', async () => {
      const result = await authService.register({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });

      expect(result.user.role).toBe('employee');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await authService.register({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });
    });

    it('should successfully login with valid credentials', async () => {
      const result = await authService.login({
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });

      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('employee@example.com');
    });

    it('should reject incorrect password', async () => {
      await expect(
        authService.login({
          email: 'employee@example.com',
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject unknown email', async () => {
      await expect(
        authService.login({
          email: 'unknown@example.com',
          password: 'StrongPassword123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject disabled account', async () => {
      await User.findOneAndUpdate({ email: 'employee@example.com' }, { isActive: false });

      await expect(
        authService.login({
          email: 'employee@example.com',
          password: 'StrongPassword123!',
        })
      ).rejects.toThrow('Account is disabled');
    });

    it('should not return password hash', async () => {
      const result = await authService.login({
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('getMe', () => {
    it('should return user profile', async () => {
      const registered = await authService.register({
        name: 'Test Employee',
        email: 'employee@example.com',
        password: 'StrongPassword123!',
      });

      const user = await authService.getMe(registered.user._id.toString());
      expect(user.email).toBe('employee@example.com');
      expect((user as any).passwordHash).toBeUndefined();
    });
  });
});
