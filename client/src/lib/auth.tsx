// Стан автентифікації: токен у localStorage, профіль — через TanStack Query. Сесій на сервері немає (JWT).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import type { AuthResponse, User } from './types';

type AuthState = {
  token: string | null;
  user: User | undefined;
  loading: boolean;
  signIn: (r: AuthResponse) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(() => tokenStore.get());

  const signOut = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    qc.clear(); // дані попереднього користувача не повинні з'явитися наступному
  }, [qc]);

  const signIn = useCallback((r: AuthResponse) => {
    tokenStore.set(r.token);
    qc.clear();
    qc.setQueryData(['profile'], r.user);
    setToken(r.token);
  }, [qc]);

  useEffect(() => { setUnauthorizedHandler(signOut); }, [signOut]);

  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api<User>('/profile'), enabled: Boolean(token) });

  const value = useMemo<AuthState>(() => ({
    token, user: profile.data, loading: Boolean(token) && profile.isPending, signIn, signOut,
  }), [token, profile.data, profile.isPending, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth використовується поза AuthProvider');
  return ctx;
}
