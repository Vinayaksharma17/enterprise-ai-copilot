import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/app-error';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  let error = { ...err } as AppError;
  error.message = err.message;

  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors)
      .map((val: any) => val.message)
      .join(', ');
    error = new AppError(message, 400);
  }

  if ((err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 409);
  }

  if (err instanceof SyntaxError && 'body' in err) {
    const message = 'Invalid JSON';
    error = new AppError(message, 400);
  }

  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && isProduction ? 'Internal Server Error' : error.message,
    ...(error.errorCode && { error: { code: error.errorCode } }),
    ...(isProduction ? {} : {}),
  });
};
