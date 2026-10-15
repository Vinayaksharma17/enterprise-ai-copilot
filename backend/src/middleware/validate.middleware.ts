import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AppError, errorCodes } from '../utils/app-error';

export const validate = (schema: z.ZodSchema<any>, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors.map((err) => err.message).join(', ');
        return next(new AppError(message, 400, errorCodes.VALIDATION_ERROR));
      }
      next(error);
    }
  };
};
