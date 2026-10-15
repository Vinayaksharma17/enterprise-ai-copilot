import {
  buildDocumentAccessFilter,
  canAccessDocument,
  AuthUser,
} from '../../src/utils/access-control';

describe('access-control', () => {
  const admin: AuthUser = { id: 'a1', role: 'admin', department: 'Admin' };
  const engineer: AuthUser = { id: 'u1', role: 'employee', department: 'Engineering' };
  const finance: AuthUser = { id: 'u2', role: 'employee', department: 'Finance' };
  const noDept: AuthUser = { id: 'u3', role: 'employee' };

  const restrictedEngineering = {
    accessLevel: 'restricted' as const,
    allowedDepartments: ['Engineering', 'Security'],
  };
  const publicDoc = { accessLevel: 'public' as const, allowedDepartments: [] };

  describe('buildDocumentAccessFilter', () => {
    it('returns an empty filter for admins (all documents)', () => {
      expect(buildDocumentAccessFilter(admin)).toEqual({});
    });

    it('allows public documents for employees', () => {
      const filter = buildDocumentAccessFilter(engineer) as {
        $or: Array<Record<string, unknown>>;
      };
      expect(filter.$or).toContainEqual({ accessLevel: 'public' });
    });

    it('allows restricted documents matching the employee department only', () => {
      const filter = buildDocumentAccessFilter(engineer) as {
        $or: Array<Record<string, unknown>>;
      };
      expect(filter.$or).toContainEqual({
        accessLevel: 'restricted',
        allowedDepartments: 'Engineering',
      });
    });

    it('omits restricted access for employees without a department', () => {
      const filter = buildDocumentAccessFilter(noDept) as {
        $or: Array<Record<string, unknown>>;
      };
      expect(filter.$or).toHaveLength(1);
      expect(filter.$or[0]).toEqual({ accessLevel: 'public' });
    });
  });

  describe('canAccessDocument', () => {
    it('allows admins to access any document', () => {
      expect(canAccessDocument(restrictedEngineering, admin)).toBe(true);
    });

    it('allows any user to access public documents', () => {
      expect(canAccessDocument(publicDoc, finance)).toBe(true);
    });

    it('allows authorized departments to access restricted documents', () => {
      expect(canAccessDocument(restrictedEngineering, engineer)).toBe(true);
    });

    it('denies unauthorized departments access to restricted documents', () => {
      expect(canAccessDocument(restrictedEngineering, finance)).toBe(false);
    });

    it('denies employees without a department access to restricted documents', () => {
      expect(canAccessDocument(restrictedEngineering, noDept)).toBe(false);
    });
  });
});
