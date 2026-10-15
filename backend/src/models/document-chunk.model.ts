import mongoose, { Document, Schema, Types } from 'mongoose';
import type { DocumentAccessLevel } from './document.model';

export interface IDocumentChunk extends Document {
  documentId: Types.ObjectId;
  /**
   * Stable identifier for the vector in ChromaDB. Deterministic for a given
   * document/chunk pair so retries are idempotent.
   */
  chunkId: string;
  chunkIndex: number;
  text: string;
  pageNumber?: number;
  sectionTitle?: string;
  department?: string;
  accessLevel: DocumentAccessLevel;
  allowedDepartments: string[];
  createdAt: Date;
}

const documentChunkSchema = new Schema<IDocumentChunk>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    chunkId: {
      type: String,
      required: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    text: {
      type: String,
      required: true,
    },
    pageNumber: {
      type: Number,
      min: 1,
    },
    sectionTitle: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    accessLevel: {
      type: String,
      enum: ['public', 'restricted'],
      required: true,
    },
    allowedDepartments: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

documentChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
documentChunkSchema.index({ chunkId: 1 }, { unique: true });

export const DocumentChunk = mongoose.model<IDocumentChunk>(
  'DocumentChunk',
  documentChunkSchema
);
