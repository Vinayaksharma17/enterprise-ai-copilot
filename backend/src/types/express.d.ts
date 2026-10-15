import { User } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'admin' | 'employee';
        name: string;
        department?: string;
      };
    }
  }
}

export {};
