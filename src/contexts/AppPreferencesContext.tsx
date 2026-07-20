'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '@/lib/india';
import { translate, type TranslationKey } from '@/lib/i18n';

export type ThemePreference = 'light' | 'dark' | 'system';

type PreferencesContextValue = {
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  language: SupportedLanguageCode;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: SupportedLanguageCode) => Promise<void>;
  t: (key: TranslationKey) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const THEME_KEY = 'fabrictrad:theme';
const LANGUAGE_KEY = 'fabrictrad:language';

function isLanguage(value: unknown): value is SupportedLanguageCode {
  return SUPPORTED_LANGUAGES.some((language) => language.code === value);
}

function isTheme(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, isDemoAccount, refreshProfile } = useAuth();
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [language, setLanguageState] = useState<SupportedLanguageCode>('en');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    const storedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
    if (isTheme(storedTheme)) setThemeState(storedTheme);
    if (isLanguage(storedLanguage)) setLanguageState(storedLanguage);
  }, []);

  useEffect(() => {
    if (isLanguage(profile?.preferred_language)) {
      setLanguageState(profile.preferred_language);
      window.localStorage.setItem(LANGUAGE_KEY, profile.preferred_language);
    }
    if (isTheme(profile?.preferred_theme)) {
      setThemeState(profile.preferred_theme);
      window.localStorage.setItem(THEME_KEY, profile.preferred_theme);
    }
  }, [profile?.preferred_language, profile?.preferred_theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const next = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      setResolvedTheme(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const persistProfilePreference = useCallback(
    async (values: { preferred_language?: SupportedLanguageCode; preferred_theme?: ThemePreference }) => {
      if (!user || isDemoAccount) return;
      const supabase = createClient();
      const { error } = await supabase
        .from('user_profiles')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (!error) await refreshProfile();
    },
    [isDemoAccount, refreshProfile, user]
  );

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      window.localStorage.setItem(THEME_KEY, next);
      void persistProfilePreference({ preferred_theme: next });
    },
    [persistProfilePreference]
  );

  const setLanguage = useCallback(
    async (next: SupportedLanguageCode) => {
      setLanguageState(next);
      window.localStorage.setItem(LANGUAGE_KEY, next);
      await persistProfilePreference({ preferred_language: next });
    },
    [persistProfilePreference]
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      theme,
      resolvedTheme,
      language,
      setTheme,
      setLanguage,
      t: (key) => translate(language, key),
    }),
    [language, resolvedTheme, setLanguage, setTheme, theme]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  return context;
}
