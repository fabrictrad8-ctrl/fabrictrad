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

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, isDemoAccount, refreshProfile } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguageCode>('en');

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
    if (isLanguage(storedLanguage)) setLanguageState(storedLanguage);

    // The current commerce release is intentionally light-only. This clears old
    // device/account dark preferences that produced low-contrast mixed surfaces.
    window.localStorage.setItem(THEME_KEY, 'light');
    document.documentElement.classList.remove('dark');
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
  }, []);

  useEffect(() => {
    if (isLanguage(profile?.preferred_language)) {
      setLanguageState(profile.preferred_language);
      window.localStorage.setItem(LANGUAGE_KEY, profile.preferred_language);
    }

    // Do not let a stale preferred_theme value reactivate the unaudited dark UI.
    window.localStorage.setItem(THEME_KEY, 'light');
    document.documentElement.classList.remove('dark');
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
  }, [profile?.preferred_language, profile?.preferred_theme]);

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
    (_next: ThemePreference) => {
      window.localStorage.setItem(THEME_KEY, 'light');
      document.documentElement.classList.remove('dark');
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.colorScheme = 'light';
      void persistProfilePreference({ preferred_theme: 'light' });
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
      theme: 'light',
      resolvedTheme: 'light',
      language,
      setTheme,
      setLanguage,
      t: (key) => translate(language, key),
    }),
    [language, setLanguage, setTheme]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  return context;
}
