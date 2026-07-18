'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { normalizeEmail, normalizeIndianPhone } from '@/lib/authValidation';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  phone_verified: boolean;
  role: 'buyer' | 'seller' | 'admin_staff' | 'super_admin';
  is_active: boolean;
  avatar_url: string | null;
}

interface AuthContextType {
  user: any;
  session: any;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
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
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
};

const googleAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';

const setOAuthRoleCookie = (role: 'buyer' | 'seller') => {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `fabrictrad_oauth_role=${role}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const supabase = createClient();

  const loadProfile = async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) {
        setProfile(data as UserProfile);
      }
    } catch {
      // ignore
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Email/Password Sign Up
  const signUp = async (email: string, password: string, metadata: any = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
          phone: metadata?.phone || '',
          role: metadata?.role || 'buyer',
        },
        emailRedirectTo: `${getAuthRedirectBase()}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  // Email/Password Sign In
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  // Google OAuth Sign In
  const signInWithGoogle = async (role: 'buyer' | 'seller' = 'buyer') => {
    if (!googleAuthEnabled) {
      throw new Error('Google sign-in is not configured. Please use email sign-in.');
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
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) throw error;
    return data;
  };

  // Send Email OTP (magic link)
  const sendEmailOtp = async (email: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${getAuthRedirectBase()}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  // Verify Email OTP token
  const verifyEmailOtp = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
    return data;
  };

  // Sign Out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  // Get Current User
  const getCurrentUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  // Check if Email is Verified
  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  // Get User Profile from Database
  const getUserProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data as UserProfile;
  };

  // Refresh profile from DB
  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  // Update phone number on user profile
  const updatePhone = async (phone: string) => {
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('user_profiles')
      .update({ phone, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;
    await loadProfile(user.id);
  };

  // Check if phone is unique across all roles
  const checkPhoneUnique = async (phone: string): Promise<{ unique: boolean; usedAs?: string }> => {
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
    if (error) return { unique: true };
    if (!data) return { unique: true };
    return { unique: false, usedAs: data.role };
  };

  // Check if email is unique across all roles
  const checkEmailUnique = async (email: string): Promise<{ unique: boolean; usedAs?: string }> => {
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
    if (error) return { unique: true };
    if (!data) return { unique: true };
    return { unique: false, usedAs: data.role };
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    profileLoading,
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
