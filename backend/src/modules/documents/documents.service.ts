import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { Document as DocumentModel, IDocument } from '../../models/document.model';
import { DocumentChunk } from '../../models/document-chunk.model';
import { processDocument, resolveStoredFilePath } from '../../services/document-processing.service';
import { getVectorStore } from '../../integrations/vector-store/vector-store.service';
import {
  AuthUser,
  buildDocumentAccessFilter,
  canAccessDocument,
} from '../../utils/access-control';
import { AppError, errorCodes } from '../../utils/app-error';
import type {
  DocumentResponse,
  ListDocumentsOptions,
  PaginatedDocuments,
  UploadDocumentMetadata,
} from './documents.types';

export const toDocumentResponse = (doc: IDocument): DocumentResponse => ({
  id: doc._id.toString(),
  name: doc.name,
  originalFilename: doc.originalFilename,
  mimeType: doc.mimeType,
  size: doc.size,
  department: doc.department,
  accessLevel: doc.accessLevel,
  allowedDepartments: doc.allowedDepartments ?? [],
  status: doc.status,
  chunkCount: doc.chunkCount,
  processingError: doc.processingError,
  uploadedBy: doc.uploadedBy.toString(),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const safeUnlink = async (filePath?: string): Promise<void> => {
  if (!filePath) {
    return;
  }
  await fsp.unlink(filePath).catch(() => undefined);
};

const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && (error as { code?: number }).code === 11000);

const defaultDocumentName = (originalFilename: string): string => {
  const base = path.basename(originalFilename, path.extname(originalFilename));
  return base.trim().slice(0, 200) || 'Untitled document';
};

/**
 * Verifies that the uploaded bytes actually match the declared type. MIME type
 * and extension alone are client-controlled and must not be trusted.
 */
export const validateFileContent = async (
  filePath: string,
  mimeType: string
): Promise<void> => {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(512);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const head = buffer.subarray(0, bytesRead);

    if (mimeType === 'application/pdf') {
      if (!head.subarray(0, 5).toString('latin1').startsWith('%PDF-')) {
        throw new AppError(
          'File content does not match the PDF format',
          400,
          errorCodes.VALIDATION_ERROR
        );
      }
      return;
    }

    if (mimeType === 'text/plain') {
      if (head.includes(0)) {
        throw new AppError(
          'File does not appear to be a valid text file',
          400,
          errorCodes.VALIDATION_ERROR
        );
      }
      return;
    }

    throw new AppError('Unsupported file type', 400, errorCodes.VALIDATION_ERROR);
  } finally {
    await handle.close();
  }
};

export const computeFileHash = (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const moveIntoPlace = async (
  tempPath: string,
  storedPath: string
): Promise<void> => {
  if (fs.existsSync(storedPath)) {
    // Content already stored (e.g. a concurrent upload of identical bytes).
    await safeUnlink(tempPath);
    return;
  }
  await fsp.rename(tempPath, storedPath);
};

export const createDocument = async (
  user: AuthUser,
  file: Express.Multer.File | undefined,
  metadata: UploadDocumentMetadata
): Promise<DocumentResponse> => {
  if (!file) {
    throw new AppError('No file uploaded', 400, errorCodes.VALIDATION_ERROR);
  }

  await validateFileContent(file.path, file.mimetype);

  const fileHash = await computeFileHash(file.path);

  const existing = await DocumentModel.findOne({ fileHash });
  if (existing) {
    await safeUnlink(file.path);
    throw new AppError(
      'A document with identical content already exists',
      409,
      errorCodes.CONFLICT
    );
  }

  const storedPath = resolveStoredFilePath({
    fileHash,
    mimeType: file.mimetype,
  });
  await moveIntoPlace(file.path, storedPath);

  const accessLevel = metadata.accessLevel;
  const allowedDepartments =
    accessLevel === 'restricted' ? metadata.allowedDepartments : [];

  let doc: IDocument;
  try {
    doc = await DocumentModel.create({
      name: metadata.name?.trim() || defaultDocumentName(file.originalname),
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      fileHash,
      department: metadata.department?.trim() || undefined,
      accessLevel,
      allowedDepartments,
      status: 'uploaded',
      chunkCount: 0,
      uploadedBy: user.id,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        'A document with identical content already exists',
        409,
        errorCodes.CONFLICT
      );
    }
    throw error;
  }

  const processed = await processDocument(doc);
  return toDocumentResponse(processed);
};

export const listDocuments = async (
  user: AuthUser,
  options: ListDocumentsOptions
): Promise<PaginatedDocuments> => {
  const filter: Record<string, unknown> = buildDocumentAccessFilter(user);
  if (options.status) {
    filter.status = options.status;
  }

  const skip = (options.page - 1) * options.limit;

  const [documents, total] = await Promise.all([
    DocumentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(options.limit),
    DocumentModel.countDocuments(filter),
  ]);

  return {
    documents: documents.map(toDocumentResponse),
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.ceil(total / options.limit) || 1,
    },
  };
};

export const getDocumentById = async (
  user: AuthUser,
  documentId: string
): Promise<DocumentResponse> => {
  if (!Types.ObjectId.isValid(documentId)) {
    throw new AppError('Document not found', 404, errorCodes.NOT_FOUND);
  }

  const doc = await DocumentModel.findById(documentId);
  if (!doc || !canAccessDocument(doc, user)) {
    // Return 404 rather than 403 so unauthorized users cannot probe for the
    // existence of restricted documents.
    throw new AppError('Document not found', 404, errorCodes.NOT_FOUND);
  }

  return toDocumentResponse(doc);
};

export const deleteDocument = async (
  user: AuthUser,
  documentId: string
): Promise<void> => {
  if (!Types.ObjectId.isValid(documentId)) {
    throw new AppError('Document not found', 404, errorCodes.NOT_FOUND);
  }

  const doc = await DocumentModel.findById(documentId);
  if (!doc) {
    throw new AppError('Document not found', 404, errorCodes.NOT_FOUND);
  }

  // Remove searchable vectors first. If this fails we abort before touching the
  // document record so vectors are never silently left orphaned and searchable.
  await getVectorStore().deleteByDocumentIds([documentId]);

  await DocumentChunk.deleteMany({ documentId });
  await DocumentModel.deleteOne({ _id: documentId });
  await safeUnlink(resolveStoredFilePath(doc));
};

export const documentsService = {
  createDocument,
  listDocuments,
  getDocumentById,
  deleteDocument,
  validateFileContent,
  computeFileHash,
};
