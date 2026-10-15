import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/env';
import { AppError, errorCodes } from '../utils/app-error';

const uploadDir = path.resolve(config.upload.dir);
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Never trust the client-supplied filename for storage. Use a random name
    // plus a validated extension; the content hash is assigned after upload.
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeAllowed = config.upload.allowedMimeTypes.includes(file.mimetype);
  const extensionAllowed = config.upload.allowedExtensions.includes(extension);

  if (!mimeAllowed || !extensionAllowed) {
    cb(
      new AppError(
        `Unsupported file type. Allowed types: ${config.upload.allowedExtensions.join(', ')}`,
        400,
        errorCodes.VALIDATION_ERROR
      )
    );
    return;
  }

  cb(null, true);
};

const multerInstance = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSizeBytes,
    files: 1,
  },
});

/**
 * Wraps multer's single-file upload and translates its errors into HTTP-aware
 * AppErrors (413 for oversized uploads, 400 for other upload problems).
 */
export const uploadSingle = (fieldName: string) => {
  const handler = multerInstance.single(fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (error: unknown) => {
      if (!error) {
        return next();
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              `File exceeds the maximum size of ${config.upload.maxFileSizeBytes} bytes`,
              413,
              errorCodes.PAYLOAD_TOO_LARGE
            )
          );
        }
        return next(new AppError(error.message, 400, errorCodes.VALIDATION_ERROR));
      }

      if (error instanceof AppError) {
        return next(error);
      }

      return next(
        new AppError('File upload failed', 400, errorCodes.VALIDATION_ERROR)
      );
    });
  };
};
