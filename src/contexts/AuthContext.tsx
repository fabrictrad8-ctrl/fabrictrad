'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';

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
      data: { subscription }
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
          role: metadata?.role || 'buyer',
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      }
    });
    if (error) throw error;
    return data;
  };

  // Email/Password Sign In
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  };

  // Google OAuth Sign In
  const signInWithGoogle = async (role: 'buyer' | 'seller' = 'buyer') => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?role=${role}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      }
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
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      }
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
    const { data: { user }, error } = await supabase.auth.getUser();
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
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('phone', phone)
      .maybeSingle();
    if (error) return { unique: true };
    if (!data) return { unique: true };
    return { unique: false, usedAs: data.role };
  };

  // Check if email is unique across all roles
  const checkEmailUnique = async (email: string): Promise<{ unique: boolean; usedAs?: string }> => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('email', email)
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
