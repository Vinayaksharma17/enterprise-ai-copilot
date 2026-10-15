import { Request, Response, NextFunction } from 'express';
import { AppError, errorCodes } from '../utils/app-error';

export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Not authorized to access this route', 401, errorCodes.UNAUTHORIZED));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Not authorized to access this route', 403, errorCodes.FORBIDDEN));
    }

    next();
  };
};
