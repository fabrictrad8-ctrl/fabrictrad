'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  can_buy?: boolean;
  can_sell?: boolean;
  account_kind?: 'individual' | 'business';
  verification_method?: 'none' | 'pan' | 'aadhaar_offline' | 'gstin';
  verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
  identity_reference_last4?: string | null;
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
  /** Compatibility flag for older components. FabricTrad no longer supports synthetic demo sessions. */
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
  const [supabase] = useState(() => createClient());
  const isDemoAccount = false;

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
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      // Token refreshes should not make the current screen appear to reload.
      if (event === 'TOKEN_REFRESHED') {
        setLoading(false);
        return;
      }

      if (nextSession?.user) {
        void loadProfile(nextSession.user.id).catch(() => setProfile(null));
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    const initialize = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      setSession(initialSession);
      setUser(initialSession?.user ?? null);
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
  }, [loadProfile, supabase]);

  const signUp = async (email: string, password: string, metadata: any = {}) => {
    const normalizedEmail = normalizeEmail(email);
    const registrationNonce = crypto.randomUUID();
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
          business_type: metadata?.businessType || '',
          pan: metadata?.pan || '',
          categories: Array.isArray(metadata?.categories) ? metadata.categories : [],
          monthly_capacity: metadata?.monthlyCapacity || '',
          verification_method:
            metadata?.verificationMethod || (metadata?.role === 'seller' ? 'gstin' : 'none'),
          identity_reference_last4: metadata?.identityReferenceLast4 || '',
          registration_nonce: registrationNonce,
        },
        emailRedirectTo: `${getAuthRedirectBase()}/auth/callback`,
      },
    });
    if (error) throw error;

    let provisioningWarning: string | null = null;
    if (data.user) {
      const response = await fetch('/api/auth/provision-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(data.session?.access_token
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {}),
        },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ userId: data.user.id, registrationNonce }),
      }).catch(() => null);
      if (!response?.ok) {
        const payload = await response?.json().catch(() => ({}));
        provisioningWarning =
          payload?.error || 'Account profile setup will finish when you verify and sign in.';
      }
    }

    return { ...data, registrationNonce, provisioningWarning };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error) throw error;

    setSession(data.session);
    setUser(data.user);
    let accountRole =
      data.user?.app_metadata?.role || data.user?.user_metadata?.role || 'buyer';

    if (data.user) {
      const provisionResponse = await fetch('/api/auth/provision-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(data.session?.access_token
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {}),
        },
        credentials: 'same-origin',
        cache: 'no-store',
        body: '{}',
      });
      const provisionPayload = await provisionResponse.json().catch(() => ({}));
      if (!provisionResponse.ok) {
        throw new Error(
          provisionPayload?.error ||
            'Your account profile could not be prepared. Please try again.'
        );
      }

      const loadedProfile = await loadProfile(data.user.id).catch(() => null);
      if (loadedProfile?.role) accountRole = loadedProfile.role;
    }

    return { ...data, role: accountRole, isDemo: false };
  };

  const signInWithGoogle = async (role: 'buyer' | 'seller' = 'buyer') => {
    if (!googleAuthEnabled) {
      throw new Error('Google sign-in is not configured. Please use your email and password.');
    }

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
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token,
      type: 'email',
    });
    if (error) throw error;
    if (data.user) {
      await fetch('/api/auth/provision-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(data.session?.access_token
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {}),
        },
        credentials: 'same-origin',
        cache: 'no-store',
        body: '{}',
      }).catch(() => undefined);
      await loadProfile(data.user.id).catch(() => setProfile(null));
    }
    return data;
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const getCurrentUser = async () => {
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return currentUser;
  };

  const isEmailVerified = () => Boolean(user?.email_confirmed_at);

  const getUserProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    return loadProfile(user.id);
  };

  const refreshProfile = async () => {
    if (!user) return;
    await fetch('/api/auth/provision-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      credentials: 'same-origin',
      cache: 'no-store',
      body: '{}',
    }).catch(() => undefined);
    await loadProfile(user.id);
  };

  const updatePhone = async (phone: string) => {
    if (!user) throw new Error('Not authenticated');
    const normalizedPhone = normalizeIndianPhone(phone);
    const { error } = await supabase
      .from('user_profiles')
      .update({ phone: normalizedPhone, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;
    await loadProfile(user.id);
  };

  const checkPhoneUnique = async (
    phone: string
  ): Promise<{ unique: boolean; usedAs?: string }> => {
    const normalizedPhone = normalizeIndianPhone(phone);
    const { data: conflictData } = await supabase
      .rpc('check_identity_conflict', { input_email: null, input_phone: normalizedPhone })
      .maybeSingle();
    const conflict = conflictData as IdentityConflict | null;
    if (conflict?.phone_used) {
      return { unique: false, usedAs: conflict.phone_role || undefined };
    }
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('phone', normalizedPhone)
      .maybeSingle();
    if (error || !data) return { unique: true };
    return { unique: false, usedAs: data.role };
  };

  const checkEmailUnique = async (
    email: string
  ): Promise<{ unique: boolean; usedAs?: string }> => {
    const normalizedEmail = normalizeEmail(email);
    const { data: conflictData } = await supabase
      .rpc('check_identity_conflict', { input_email: normalizedEmail, input_phone: null })
      .maybeSingle();
    const conflict = conflictData as IdentityConflict | null;
    if (conflict?.email_used) {
      return { unique: false, usedAs: conflict.email_role || undefined };
    }
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
