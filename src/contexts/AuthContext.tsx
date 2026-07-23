'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createClient } from '../lib/supabase/client';
import { normalizeEmail, normalizeIndianPhone } from '@/lib/authValidation';

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
  updatePassword: (password: string) => Promise<void>;
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
  role?: DemoRole | null;
  error?: string;
};

const DEMO_IDENTITIES: Record<DemoRole, { user: any; profile: UserProfile }> = {
  buyer: {
    user: {
      id: 'fabrictrad-demo-buyer',
      email: 'demo.buyer@fabrictrad.com',
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { role: 'buyer', demo: true },
      user_metadata: { full_name: 'FabricTrad Demo Buyer', role: 'buyer', demo: true },
    },
    profile: {
      id: 'fabrictrad-demo-buyer',
      email: 'demo.buyer@fabrictrad.com',
      full_name: 'FabricTrad Demo Buyer',
      phone: '9000000101',
      phone_verified: true,
      role: 'buyer',
      is_active: true,
      avatar_url: null,
      business_name: 'Demo Buyer Textiles',
      gstin: '24ABCDE1234F1Z5',
      city: 'Mumbai',
      state: 'Maharashtra',
      address_line1: 'Demo Sourcing Office',
      pincode: '400001',
      preferred_language: 'en',
      preferred_theme: 'system',
    },
  },
  seller: {
    user: {
      id: 'fabrictrad-demo-seller',
      email: 'demo.seller@fabrictrad.com',
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { role: 'seller', demo: true },
      user_metadata: { full_name: 'FabricTrad Demo Seller', role: 'seller', demo: true },
    },
    profile: {
      id: 'fabrictrad-demo-seller',
      email: 'demo.seller@fabrictrad.com',
      full_name: 'FabricTrad Demo Seller',
      phone: '9000000202',
      phone_verified: true,
      role: 'seller',
      is_active: true,
      avatar_url: null,
      business_name: 'FabricTrad Demo Textiles',
      gstin: '27ABCDE1234F1Z5',
      city: 'Surat',
      state: 'Gujarat',
      address_line1: 'Demo Textile Market, Ring Road',
      pincode: '395002',
      preferred_language: 'en',
      preferred_theme: 'system',
    },
  },
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

const createDemoSession = async (email: string, password: string): Promise<DemoRole> => {
  const response = await fetch('/api/auth/demo-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json().catch(() => ({}))) as DemoSessionResponse;
  if (!response.ok || (payload.role !== 'buyer' && payload.role !== 'seller')) {
    throw new Error(payload.error || 'Invalid login credentials.');
  }
  return payload.role;
};

const clearDemoSession = async () => {
  await fetch('/api/auth/demo-session', {
    method: 'DELETE',
    credentials: 'same-origin',
    cache: 'no-store',
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
  const demoActiveRef = useRef(false);

  const applyDemoSession = useCallback((role: DemoRole) => {
    const identity = DEMO_IDENTITIES[role];
    demoActiveRef.current = true;
    setSession(null);
    setUser(identity.user);
    setProfile(identity.profile);
    setIsDemoAccount(true);
    setLoading(false);
    return identity;
  }, []);

  const loadProfile = useCallback(
    async (userId: string) => {
      setProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (error) throw error;
        const nextProfile = (data as UserProfile | null) ?? null;
        setProfile(nextProfile);
        return nextProfile;
      } finally {
        setProfileLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled || demoActiveRef.current) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsDemoAccount(false);
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id).catch(() => setProfile(null));
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    const initialize = async () => {
      const demoRole = await readDemoSession();
      if (cancelled) return;

      if (demoRole) {
        demoActiveRef.current = true;
        await supabase.auth.signOut().catch(() => undefined);
        if (!cancelled) applyDemoSession(demoRole);
        return;
      }

      demoActiveRef.current = false;
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsDemoAccount(false);
      if (initialSession?.user) {
        await loadProfile(initialSession.user.id).catch(() => setProfile(null));
      } else {
        setProfile(null);
      }
      if (!cancelled) setLoading(false);
    };

    void initialize();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applyDemoSession, loadProfile, supabase]);

  const signUp = async (email: string, password: string, metadata: any = {}) => {
    const normalizedEmail = normalizeEmail(email);
    if (
      normalizedEmail === 'demo.buyer@fabrictrad.com' ||
      normalizedEmail === 'demo.seller@fabrictrad.com'
    ) {
      throw new Error('This reserved account can only be used for sign in.');
    }

    await clearDemoSession();
    demoActiveRef.current = false;
    setIsDemoAccount(false);

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
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
    const isDemoEmail =
      normalizedEmail === 'demo.buyer@fabrictrad.com' ||
      normalizedEmail === 'demo.seller@fabrictrad.com';

    if (isDemoEmail) {
      const role = await createDemoSession(normalizedEmail, password);
      demoActiveRef.current = true;
      await supabase.auth.signOut().catch(() => undefined);
      const identity = applyDemoSession(role);
      return {
        user: identity.user,
        session: null,
        role,
        isDemo: true,
      };
    }

    await clearDemoSession();
    demoActiveRef.current = false;
    setIsDemoAccount(false);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) throw error;

    setSession(data.session);
    setUser(data.user);
    let accountRole =
      data.user?.app_metadata?.role || data.user?.user_metadata?.role || 'buyer';

    if (data.user) {
      const loadedProfile = await loadProfile(data.user.id).catch(() => null);
      if (loadedProfile?.role) accountRole = loadedProfile.role;
    }

    return { ...data, role: accountRole, isDemo: false };
  };

  const signInWithGoogle = async (role: 'buyer' | 'seller' = 'buyer') => {
    if (!googleAuthEnabled) {
      throw new Error('Google sign-in is not configured. Please use your email and password.');
    }

    await clearDemoSession();
    demoActiveRef.current = false;
    setIsDemoAccount(false);

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
    await clearDemoSession();
    demoActiveRef.current = false;
    setIsDemoAccount(false);

    const { data, error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${getAuthRedirectBase()}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    demoActiveRef.current = false;
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token,
      type: 'email',
    });
    if (error) throw error;
    if (data.user) await loadProfile(data.user.id).catch(() => setProfile(null));
    return data;
  };

  const updatePassword = async (password: string) => {
    if (isDemoAccount) throw new Error('The shared demo password cannot be changed.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const signOut = async () => {
    await clearDemoSession();
    demoActiveRef.current = false;
    const { error } = await supabase.auth.signOut();
    if (error && !isDemoAccount) throw error;
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
    return loadProfile(user.id);
  };

  const refreshProfile = async () => {
    if (user && !isDemoAccount) await loadProfile(user.id);
  };

  const updatePhone = async (phone: string) => {
    if (!user) throw new Error('Not authenticated');
    const normalizedPhone = normalizeIndianPhone(phone);
    if (isDemoAccount) {
      setProfile((current) =>
        current ? { ...current, phone: normalizedPhone, phone_verified: true } : current
      );
      return;
    }
    const { error } = await supabase
      .from('user_profiles')
      .update({ phone: normalizedPhone, updated_at: new Date().toISOString() })
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
    updatePassword,
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
