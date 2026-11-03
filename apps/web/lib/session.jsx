'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { api } from './api';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: current } = await api.get('/api/auth/me');
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async (email, password) => {
    const { user: current } = await api.post('/api/auth/login', { email, password });
    setUser(current);
    return current;
  }, []);

  const signUp = useCallback(async (payload) => {
    const { user: current } = await api.post('/api/auth/register', payload);
    setUser(current);
    return current;
  }, []);

  const signOut = useCallback(async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, signIn, signUp, signOut }), [user, loading, refresh, signIn, signUp, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

export function homeFor(user) {
  if (!user) return '/login';
  if (user.role === 'dispatcher' || user.role === 'admin') return '/dashboard';
  if (user.role === 'contractor') return '/jobs';
  return '/call';
}

export function useRedirectOnRole() {
  const router = useRouter();
  return useCallback(
    (user) => {
      router.replace(homeFor(user));
    },
    [router],
  );
}
