'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, getMe, User } from './api-client';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  ready: boolean;
  loadingUser: boolean;
  error: string;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const clearSession = () => {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
};

/**
 * Client-side auth state for the authenticated area. Reuses the existing
 * sessionStorage token strategy and the backend `/auth/me` endpoint to confirm
 * the session is still valid. Frontend gating is a convenience only; the
 * backend remains the security boundary.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedToken = sessionStorage.getItem('token');
    if (!storedToken) {
      router.replace('/login');
      return;
    }

    setToken(storedToken);
    setLoadingUser(true);

    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        // ignore malformed cached user; /auth/me will repopulate it
      }
    }

    let active = true;
    getMe(storedToken)
      .then((response) => {
        if (!active) return;
        if (response.success && response.data) {
          setUser(response.data);
          sessionStorage.setItem('user', JSON.stringify(response.data));
        }
        setError('');
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearSession();
          router.replace('/login');
          return;
        }
        // Non-auth failure (e.g. backend down): keep the cached identity but
        // surface a clear message instead of silently signing the user out.
        setError(err instanceof ApiError ? err.message : 'Failed to load your profile.');
      })
      .finally(() => {
        if (!active) return;
        setLoadingUser(false);
        setReady(true);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const logout = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, ready, loadingUser, error, logout }),
    [user, token, ready, loadingUser, error, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
