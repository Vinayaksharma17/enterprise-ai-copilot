import { z } from 'zod';

export const chatRequestSchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(2000),
  conversationId: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{24}$/, 'Invalid conversation id')
    .nullish(),
});

export const conversationIdParamSchema = z.object({
  id: z.string().trim().regex(/^[a-fA-F0-9]{24}$/, 'Invalid conversation id'),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
