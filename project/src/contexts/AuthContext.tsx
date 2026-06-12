import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import * as api from '../lib/api';
import type { Profile } from '../lib/types';

interface Ctx {
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password?: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const uid = localStorage.getItem('viva_user_id');
    if (!uid) { setLoading(false); return; }
    try {
      const p = await api.fetchProfile();
      setProfile(p as Profile);
    } catch {
      // Fallback to mock Supabase if backend unavailable
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (data) setProfile(data as Profile);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const signIn = async (email: string, _password?: string) => {
    try {
      const p = await api.login(email);
      setProfile(p as Profile);
    } catch {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: _password || 'password' });
      if (error) throw error;
      if (data?.user) {
        localStorage.setItem('viva_user_id', data.user.id);
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (profileData) setProfile(profileData as Profile);
      }
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const p = await api.login(email, name);
      setProfile(p as Profile);
    } catch {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) throw error;
      if (data?.user) {
        localStorage.setItem('viva_user_id', data.user.id);
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (profileData) setProfile(profileData as Profile);
      }
    }
  };

  const signOut = async () => {
    localStorage.removeItem('viva_user_id');
    await supabase.auth.signOut();
    setProfile(null);
  };

  return <AuthContext.Provider value={{ profile, loading, signIn, signUp, signOut, refreshProfile: loadProfile }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => { const c = useContext(AuthContext); if (!c) throw new Error('useAuth outside provider'); return c; };
