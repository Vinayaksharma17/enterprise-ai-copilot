import { Request, Response, NextFunction } from 'express';
import { AppError, errorCodes } from '../utils/app-error';

export const notFound = (_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError('Not Found', 404, errorCodes.NOT_FOUND));
};
