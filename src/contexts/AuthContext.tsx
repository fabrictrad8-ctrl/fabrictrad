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

type DemoRole = 'buyer' | 'seller';

type DemoSessionResponse = {
  role?: DemoRole;
  error?: string;
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

const readDemoSession = async (): Promise<DemoRole | null> => {
  try {
    const response = await fetch('/api/auth/demo-session', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as DemoSessionResponse;
    return payload.role === 'buyer' || payload.role === 'seller' ? payload.role : null;
  } catch {
    return null;
  }
};

const createDemoSessionCookie = async (email: string, password: string): Promise<DemoRole> => {
  const response = await fetch('/api/auth/demo-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json().catch(() => ({}))) as DemoSessionResponse;
  if (!response.ok || (payload.role !== 'buyer' && payload.role !== 'seller')) {
    throw new Error(payload.error || 'Unable to start the demo session.');
  }
  return payload.role;
};

const clearDemoSessionCookie = async () => {
  await fetch('/api/auth/demo-session', {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => undefined);
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
  const [supabase] = useState(() => createClient());

  const buildDemoSession = (role: DemoRole) => {
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

  const applyDemoSession = (role: DemoRole) => {
    const demoSession = buildDemoSession(role);
    if (!demoSession) return false;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DEMO_SESSION_STORAGE_KEY, role);
    }
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
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const initializeAuth = async () => {
      const demoRole = await readDemoSession();
      if (cancelled) return;

      if (demoRole) {
        applyDemoSession(demoRole);
        return;
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
      }

      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsDemoAccount(false);
      if (initialSession?.user) {
        await loadProfile(initialSession.user.id);
      } else {
        setProfile(null);
      }
      if (!cancelled) setLoading(false);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (cancelled) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setIsDemoAccount(false);
        if (nextSession?.user) void loadProfile(nextSession.user.id);
        else setProfile(null);
        setLoading(false);
      });
      unsubscribe = () => subscription.unsubscribe();
    };

    void initializeAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [supabase]);

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
    const normalizedEmail = normalizeEmail(email);
    const demoAccount = validateDemoCredentials(normalizedEmail, password);

    if (demoAccount) {
      await supabase.auth.signOut().catch(() => undefined);
      const role = await createDemoSessionCookie(normalizedEmail, password);
      applyDemoSession(role);
      const demoSession = buildDemoSession(role);
      return {
        user: demoSession?.user ?? null,
        session: null,
        role,
        isDemo: true,
      };
    }

    if (getDemoAccountByEmail(normalizedEmail)) {
      throw new Error('Invalid demo password. Use the demo credentials shown on this page.');
    }

    await clearDemoSessionCookie();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) throw error;

    let role = data.user?.app_metadata?.role || data.user?.user_metadata?.role || null;
    if (data.user) {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      if (profileData) {
        setProfile(profileData as UserProfile);
        role = profileData.role;
      }
    }

    return { ...data, role, isDemo: false };
  };

  const signInWithGoogle = async (role: 'buyer' | 'seller' = 'buyer') => {
    if (!googleAuthEnabled) throw new Error('Google sign-in is not configured. Please use email sign-in.');
    const statusResponse = await fetch('/api/auth/google/status', { cache: 'no-store' });
    if (!statusResponse.ok) {
      const status = await statusResponse.json().catch(() => null);
      throw new Error(status?.message || 'Google sign-in is not fully configured.');
    }
    await clearDemoSessionCookie();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
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
    await clearDemoSessionCookie();
    const { data, error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: { shouldCreateUser: true, emailRedirectTo: `${getAuthRedirectBase()}/auth/callback` },
    });
    if (error) throw error;
    return data;
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token,
      type: 'email',
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await clearDemoSessionCookie();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setUser(null);
    setSession(null);
    setIsDemoAccount(false);
  };

  const getCurrentUser = async () => {
    if (isDemoAccount) return user;
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return currentUser;
  };

  const isEmailVerified = () => isDemoAccount || Boolean(user?.email_confirmed_at);

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
      setProfile((current) => (current ? { ...current, phone } : current));
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
