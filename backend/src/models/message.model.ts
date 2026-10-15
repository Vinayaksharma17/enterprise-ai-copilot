import mongoose, { Document, Schema, Types } from 'mongoose';

export type MessageRole = 'user' | 'assistant';

export interface IMessageSource {
  documentId: string;
  documentName: string;
  chunkId: string;
  pageNumber?: number;
  sectionTitle?: string;
  excerpt: string;
}

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MessageRole;
  content: string;
  sources: IMessageSource[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSourceSchema = new Schema<IMessageSource>(
  {
    documentId: { type: String, required: true },
    documentName: { type: String, required: true },
    chunkId: { type: String, required: true },
    pageNumber: { type: Number },
    sectionTitle: { type: String },
    excerpt: { type: String, required: true },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sources: {
      type: [messageSourceSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
