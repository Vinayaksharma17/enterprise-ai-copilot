import type { FilterQuery } from 'mongoose';
import type { IDocument } from '../models/document.model';

export interface AuthUser {
  id: string;
  role: 'admin' | 'employee';
  department?: string;
}

/**
 * Builds a MongoDB filter that matches only documents the given user is allowed
 * to access. Access metadata always comes from the persisted document record and
 * from the trusted authenticated user, never from client input.
 *
 * - admins: every document
 * - employees: public documents, or restricted documents that explicitly list
 *   the employee's department in `allowedDepartments`
 */
export const buildDocumentAccessFilter = (
  user: AuthUser
): FilterQuery<IDocument> => {
  if (user.role === 'admin') {
    return {};
  }

  const or: FilterQuery<IDocument>[] = [{ accessLevel: 'public' }];

  if (user.department) {
    or.push({
      accessLevel: 'restricted',
      allowedDepartments: user.department,
    });
  }

  return { $or: or };
};

/**
 * Authoritative, per-record authorization check used as defence in depth once a
 * document has been loaded (for example when resolving retrieved source
 * metadata). Mirrors {@link buildDocumentAccessFilter}.
 */
export const canAccessDocument = (
  doc: Pick<IDocument, 'accessLevel' | 'allowedDepartments'>,
  user: AuthUser
): boolean => {
  if (user.role === 'admin') {
    return true;
  }

  if (doc.accessLevel === 'public') {
    return true;
  }

  if (!user.department) {
    return false;
  }

  return doc.allowedDepartments.includes(user.department);
};
