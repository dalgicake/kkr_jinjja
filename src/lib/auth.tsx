import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ensureAnonymousSession, supabase, type AuthState } from './supabase';

const AuthContext = createContext<AuthState>({ status: 'loading' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    supabase ? { status: 'loading' } : { status: 'not_connected' },
  );
  useEffect(() => {
    let alive = true;
    void ensureAnonymousSession().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthState => useContext(AuthContext);
