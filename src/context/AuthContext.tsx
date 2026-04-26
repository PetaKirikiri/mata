import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type AppUserRow = {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  appUser: AppUserRow | null;
  studentId: number | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

function coerceInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [appUser, setAppUser] = useState<AppUserRow | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);

  const loadProfile = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setAppUser(null);
      setStudentId(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      await supabase.rpc('claim_app_user_by_email');
      await supabase.rpc('portal_ensure_app_user_for_auth');
      const { data: au, error } = await supabase
        .from('app_users')
        .select('id, email, display_name, role')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();
      if (error || !au) {
        setAppUser(null);
        setStudentId(null);
        return;
      }
      setAppUser({
        id: au.id as number,
        email: au.email as string,
        display_name: (au.display_name as string | null) ?? null,
        role: au.role as string,
      });
      const { data: st } = await supabase
        .from('students')
        .select('id')
        .eq('app_user_id', au.id)
        .maybeSingle();
      setStudentId(coerceInt(st?.id));
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await loadProfile(session?.user ?? null);
  }, [loadProfile]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        return loadProfile(session?.user ?? null);
      })
      .catch(() => {
        setUser(null);
        void loadProfile(null);
      })
      .finally(() => setSessionReady(true));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      void loadProfile(session?.user ?? null);
      void queryClient.invalidateQueries({ queryKey: ['mata'] });
    });
    return () => subscription.unsubscribe();
  }, [loadProfile, queryClient]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAppUser(null);
    setStudentId(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: !sessionReady || (user !== null && profileLoading),
        appUser,
        studentId,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
