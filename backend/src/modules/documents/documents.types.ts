import type { DocumentAccessLevel, DocumentStatus } from '../../models/document.model';

export interface UploadDocumentMetadata {
  name?: string;
  accessLevel: DocumentAccessLevel;
  department?: string;
  allowedDepartments: string[];
}

export interface DocumentResponse {
  id: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  department?: string;
  accessLevel: DocumentAccessLevel;
  allowedDepartments: string[];
  status: DocumentStatus;
  chunkCount: number;
  processingError?: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListDocumentsOptions {
  page: number;
  limit: number;
  status?: DocumentStatus;
}

export interface PaginatedDocuments {
  documents: DocumentResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
