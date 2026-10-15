import { z } from 'zod';

/**
 * Accepts either a JSON array (`["HR","Finance"]`), a repeated field
 * (`a=HR&a=Finance`) or a comma-separated string (`HR,Finance`) and normalizes
 * to a de-duplicated, trimmed list of non-empty department names.
 */
const parseStringArray = (value: unknown): string[] => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  let items: unknown[];
  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        items = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        items = trimmed.split(',');
      }
    } else {
      items = trimmed.split(',');
    }
  } else {
    items = [value];
  }

  const normalized = items
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0 && item.length <= 100);

  return Array.from(new Set(normalized));
};

export const uploadDocumentSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  accessLevel: z.enum(['public', 'restricted']).default('public'),
  department: z.string().trim().max(100).optional(),
  allowedDepartments: z.preprocess(
    parseStringArray,
    z.array(z.string())
  ),
});

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['uploaded', 'processing', 'processed', 'failed']).optional(),
});

export const documentIdParamSchema = z.object({
  id: z.string().trim().regex(/^[a-fA-F0-9]{24}$/, 'Invalid document id'),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
