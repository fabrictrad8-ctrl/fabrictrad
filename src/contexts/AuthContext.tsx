'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { normalizeEmail, normalizeIndianPhone } from '@/lib/authValidation';
import {
  DEMO_SESSION_STORAGE_KEY,
  getDemoAccountByEmail,
  getDemoUserId,
  validateDemoCredentials,
} from '@/lib/demoAccounts';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  phone_verified: boolean;
  role: 'buyer' | 'seller' | 'admin_staff' | 'super_admin';
  is_active: boolean;
  avatar_url: string | null;
  preferred_language?: string | null;
  preferred_theme?: 'light' | 'dark' | 'system' | null;
  business_name?: string | null;
  gstin?: string | null;
  city?: string | null;
  state?: string | null;
  address_line1?: string | null;
  pincode?: string | null;
}

interface AuthContextType {
  user: any;
  session: any;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  isDemoAccount: boolean;
  googleAuthEnabled: boolean;
  signUp: (email: string, password: string, metadata?: any) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signInWithGoogle: (role?: 'buyer' | 'seller') => Promise<any>;
  sendEmailOtp: (email: string) => Promise<any>;
  verifyEmailOtp: (email: string, token: string) => Promise<any>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<any>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<UserProfile | null>;
  updatePhone: (phone: string) => Promise<void>;
  checkPhoneUnique: (phone: string) => Promise<{ unique: boolean; usedAs?: string }>;
  checkEmailUnique: (email: string) => Promise<{ unique: boolean; usedAs?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

type IdentityConflict = {
  email_used?: boolean;
  email_role?: string | null;
  phone_used?: boolean;
  phone_role?: string | null;
};

const getAuthRedirectBase = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
};

const googleAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';

const setOAuthRoleCookie = (role: 'buyer' | 'seller') => {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `fabrictrad_oauth_role=${role}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isDemoAccount, setIsDemoAccount] = useState(false);
  const supabase = createClient();

  const buildDemoSession = (role: 'buyer' | 'seller') => {
    const account = getDemoAccountByEmail(
      role === 'buyer' ? 'demo.buyer@fabrictrad.com' : 'demo.seller@fabrictrad.com'
    );
    if (!account) return null;
    const id = getDemoUserId(role);
    return {
      user: {
        id,
        email: account.email,
        email_confirmed_at: new Date().toISOString(),
        user_metadata: { full_name: account.fullName, role, demo: true },
        app_metadata: { role, demo: true },
      },
      profile: {
        id,
        email: account.email,
        full_name: account.fullName,
        phone: account.phone,
        phone_verified: true,
        role,
        is_active: true,
        avatar_url: null,
        business_name: account.company,
        gstin: role === 'seller' ? '27ABCDE1234F1Z5' : '24ABCDE1234F1Z5',
        city: role === 'seller' ? 'Surat' : 'Mumbai',
        state: role === 'seller' ? 'Gujarat' : 'Maharashtra',
        address_line1: role === 'seller' ? 'Demo Textile Market, Ring Road' : 'Demo Sourcing Office',
        pincode: role === 'seller' ? '395002' : '400001',
        preferred_language: 'en',
        preferred_theme: 'system',
      } as UserProfile,
    };
  };

  const applyDemoSession = (role: 'buyer' | 'seller') => {
    const demoSession = buildDemoSession(role);
    if (!demoSession) return false;
    localStorage.setItem(DEMO_SESSION_STORAGE_KEY, role);
    setSession(null);
    setUser(demoSession.user);
    setProfile(demoSession.profile);
    setIsDemoAccount(true);
    setLoading(false);
    return true;
  };

  const loadProfile = async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) setProfile(data as UserProfile);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const storedDemoRole = typeof window !== 'undefined'
      ? localStorage.getItem(DEMO_SESSION_STORAGE_KEY)
      : null;
    if (storedDemoRole === 'buyer' || storedDemoRole === 'seller') {
      applyDemoSession(storedDemoRole);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) void loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsDemoAccount(false);
      if (nextSession?.user) void loadProfile(nextSession.user.id);
      else setProfile(null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata: any = {}) => {
    if (getDemoAccountByEmail(email)) {
      throw new Error('Demo accounts are built into FabricTrad. Please sign in with the demo password.');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
          phone: metadata?.phone || '',
          role: metadata?.role || 'buyer',
          business_name: metadata?.businessName || '',
          gstin: metadata?.gstin || '',
          address_line1: metadata?.addressLine1 || '',
          address_line2: metadata?.addressLine2 || '',
          city: metadata?.city || '',
          state: metadata?.state || '',
          pincode: metadata?.pincode || '',
          preferred_language: metadata?.preferredLanguage || 'en',
          preferred_theme: metadata?.preferredTheme || 'system',
        },
        emailRedirectTo: `${getAuthRedirectBase()}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const demoAccount = validateDemoCredentials(email, password);
    if (demoAccount) {
      await supabase.auth.signOut().catch(() => undefined);
      applyDemoSession(demoAccount.role);
      return { user: buildDemoSession(demoAccount.role)?.user, session: null };
    }
    if (getDemoAccountByEmail(email)) {
      throw new Error('Invalid demo password. Use the demo credentials shown on this page.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signInWithGoogle = async (role: 'buyer' | 'seller' = 'buyer') => {
    if (!googleAuthEnabled) throw new Error('Google sign-in is not configured. Please use email sign-in.');
    const statusResponse = await fetch('/api/auth/google/status', { cache: 'no-store' });
    if (!statusResponse.ok) {
      const status = await statusResponse.json().catch(() => null);
      throw new Error(status?.message || 'Google sign-in is not fully configured.');
    }
    setOAuthRoleCookie(role);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getAuthRedirectBase()}/auth/callback?role=${role}`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    return data;
  };

  const sendEmailOtp = async (email: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${getAuthRedirectBase()}/auth/callback` },
    });
    if (error) throw error;
    return data;
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    if (typeof window !== 'undefined') localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setUser(null);
    setSession(null);
    setIsDemoAccount(false);
  };

  const getCurrentUser = async () => {
    if (isDemoAccount) return user;
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return currentUser;
  };

  const isEmailVerified = () => isDemoAccount || user?.email_confirmed_at !== null;

  const getUserProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    if (isDemoAccount) return profile;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data as UserProfile;
  };

  const refreshProfile = async () => {
    if (user && !isDemoAccount) await loadProfile(user.id);
  };

  const updatePhone = async (phone: string) => {
    if (!user) throw new Error('Not authenticated');
    if (isDemoAccount) {
      setProfile((current) => current ? { ...current, phone } : current);
      return;
    }
    const { error } = await supabase
      .from('user_profiles')
      .update({ phone, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;
    await loadProfile(user.id);
  };

  const checkPhoneUnique = async (phone: string): Promise<{ unique: boolean; usedAs?: string }> => {
    const normalizedPhone = normalizeIndianPhone(phone);
    const { data: conflictData } = await supabase
      .rpc('check_identity_conflict', { input_email: null, input_phone: normalizedPhone })
      .maybeSingle();
    const conflict = conflictData as IdentityConflict | null;
    if (conflict?.phone_used) return { unique: false, usedAs: conflict.phone_role || undefined };
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('phone', normalizedPhone)
      .maybeSingle();
    if (error || !data) return { unique: true };
    return { unique: false, usedAs: data.role };
  };

  const checkEmailUnique = async (email: string): Promise<{ unique: boolean; usedAs?: string }> => {
    const normalizedEmail = normalizeEmail(email);
    const { data: conflictData } = await supabase
      .rpc('check_identity_conflict', { input_email: normalizedEmail, input_phone: null })
      .maybeSingle();
    const conflict = conflictData as IdentityConflict | null;
    if (conflict?.email_used) return { unique: false, usedAs: conflict.email_role || undefined };
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (error || !data) return { unique: true };
    return { unique: false, usedAs: data.role };
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    profileLoading,
    isDemoAccount,
    googleAuthEnabled,
    signUp,
    signIn,
    signInWithGoogle,
    sendEmailOtp,
    verifyEmailOtp,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
    updatePhone,
    checkPhoneUnique,
    checkEmailUnique,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
