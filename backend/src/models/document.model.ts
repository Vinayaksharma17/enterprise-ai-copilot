import mongoose, { Schema, Types } from 'mongoose';

export type DocumentAccessLevel = 'public' | 'restricted';
export type DocumentStatus = 'uploaded' | 'processing' | 'processed' | 'failed';

export interface IDocument extends mongoose.Document {
  name: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  fileHash: string;
  department?: string;
  accessLevel: DocumentAccessLevel;
  allowedDepartments: string[];
  status: DocumentStatus;
  chunkCount: number;
  processingError?: string;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    fileHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    department: {
      type: String,
      trim: true,
    },
    accessLevel: {
      type: String,
      enum: ['public', 'restricted'],
      default: 'public',
      required: true,
    },
    allowedDepartments: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'processed', 'failed'],
      default: 'uploaded',
      required: true,
      index: true,
    },
    chunkCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    processingError: {
      type: String,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ accessLevel: 1, department: 1 });
documentSchema.index({ createdAt: -1 });

export const Document = mongoose.model<IDocument>('Document', documentSchema);
