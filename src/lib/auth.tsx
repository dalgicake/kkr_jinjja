import type { User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ensureAnonymousSession, supabase, type AuthState } from './supabase';

const AuthContext = createContext<AuthState>({ status: 'loading' });
const UserContext = createContext<User | null>(null);

/**
 * Keeps the current user in context. Starts (or resumes) an anonymous session on load, follows
 * sign-ins from the email link / Google / Kakao, and after a sign-out or account deletion starts a
 * fresh anonymous session so the app keeps working.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    supabase ? { status: 'loading' } : { status: 'not_connected' },
  );
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let alive = true;
    const settle = (s: AuthState) => {
      if (alive) setState(s);
    };
    const refreshUser = () =>
      client.auth.getSession().then(({ data }) => {
        if (alive) setUser(data.session?.user ?? null);
      });

    void ensureAnonymousSession().then((s) => {
      settle(s);
      void refreshUser();
    });

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      if (session) {
        setState({ status: 'signed_in', userId: session.user.id });
        return;
      }
      if (event === 'SIGNED_OUT') {
        setState({ status: 'loading' });
        // never call supabase from inside this callback (it holds the auth lock): defer
        setTimeout(() => void ensureAnonymousSession().then(settle), 0);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={state}>
      <UserContext.Provider value={user}>{children}</UserContext.Provider>
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthState => useContext(AuthContext);

/** The full Supabase user (email, is_anonymous, identities, new_email), or null. */
export const useAuthUser = (): User | null => useContext(UserContext);
