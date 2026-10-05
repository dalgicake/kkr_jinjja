import type { User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ensureAnonymousSession, supabase, type AuthState } from './supabase';

const AuthContext = createContext<AuthState>({ status: 'loading' });
const UserContext = createContext<User | null>(null);
const RetryContext = createContext<() => void>(() => {});

/**
 * Keeps the current user in context. Starts (or resumes) an anonymous session on load, follows
 * sign-ins from the email link / Google / Kakao, and after a sign-out or account deletion starts a
 * fresh anonymous session so the app keeps working. If starting the session fails, `useAuthRetry`
 * tries again.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    supabase ? { status: 'loading' } : { status: 'not_connected' },
  );
  const [user, setUser] = useState<User | null>(null);
  const [attempt, setAttempt] = useState(0);

  // start (or resume) the session; runs again on each retry
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let alive = true;
    void ensureAnonymousSession().then((s) => {
      if (!alive) return;
      setState(s);
      void client.auth.getSession().then(({ data }) => {
        if (alive) setUser(data.session?.user ?? null);
      });
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let alive = true;
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
        setTimeout(
          () =>
            void ensureAnonymousSession().then((s) => {
              if (alive) setState(s);
            }),
          0,
        );
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const retry = useCallback(() => {
    if (!supabase) return;
    setState({ status: 'loading' });
    setAttempt((a) => a + 1);
  }, []);

  return (
    <AuthContext.Provider value={state}>
      <RetryContext.Provider value={retry}>
        <UserContext.Provider value={user}>{children}</UserContext.Provider>
      </RetryContext.Provider>
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthState => useContext(AuthContext);

/** Try starting the session again (after status 'error'). */
export const useAuthRetry = (): (() => void) => useContext(RetryContext);

/** The full Supabase user (email, is_anonymous, identities, new_email), or null. */
export const useAuthUser = (): User | null => useContext(UserContext);
