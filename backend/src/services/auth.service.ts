import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../models/user.model';
import { AppError, errorCodes } from '../utils/app-error';

interface RegisterData {
  name: string;
  email: string;
  password: string;
  department?: string;
}

interface LoginData {
  email: string;
  password: string;
}

export const generateToken = (userId: string): string => {
  const secret = process.env.JWT_ACCESS_SECRET;
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';

  if (!secret) {
    throw new AppError('Server configuration error', 500, errorCodes.INTERNAL_ERROR);
  }

  return jwt.sign({ id: userId }, secret, { expiresIn } as SignOptions);
};

export const hashPassword = async (password: string): Promise<string> => {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  return bcrypt.hash(password, rounds);
};

export const authService = {
  async register(data: RegisterData) {
    const { name, email, password, department } = data;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new AppError('Email already exists', 409, errorCodes.CONFLICT);
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'employee',
      department: department?.trim(),
      isActive: true,
    });

    const token = generateToken(user._id.toString());

    const userObject = user.toObject();
    delete (userObject as any).passwordHash;

    return {
      user: userObject,
      token,
    };
  },

  async login(data: LoginData) {
    const { email, password } = data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) {
      throw new AppError('Invalid credentials', 401, errorCodes.UNAUTHORIZED);
    }

    if (!user.isActive) {
      throw new AppError('Account is disabled', 401, errorCodes.UNAUTHORIZED);
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401, errorCodes.UNAUTHORIZED);
    }

    const token = generateToken(user._id.toString());

    const userObject = user.toObject();
    delete (userObject as any).passwordHash;

    return {
      user: userObject,
      token,
    };
  },

  async getMe(userId: string) {
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      throw new AppError('User not found', 404, errorCodes.NOT_FOUND);
    }
    return user;
  },
};
