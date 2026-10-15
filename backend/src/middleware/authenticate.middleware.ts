import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, errorCodes } from '../utils/app-error';
import { User } from '../models/user.model';

interface JwtPayload {
  id: string;
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Not authorized to access this route', 401, errorCodes.UNAUTHORIZED);
    }

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new AppError('Server configuration error', 500, errorCodes.INTERNAL_ERROR);
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;
    const user = await User.findById(decoded.id).select('+passwordHash');

    if (!user || !user.isActive) {
      throw new AppError('Not authorized to access this route', 401, errorCodes.UNAUTHORIZED);
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired', 401, errorCodes.UNAUTHORIZED));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token', 401, errorCodes.UNAUTHORIZED));
    }
    next(new AppError('Not authorized to access this route', 401, errorCodes.UNAUTHORIZED));
  }
};
