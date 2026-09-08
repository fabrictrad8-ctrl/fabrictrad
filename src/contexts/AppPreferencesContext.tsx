'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  const preferenceQueue = useRef<Promise<void>>(Promise.resolve());
  const profileLanguageLoadedFor = useRef<string | null>(null);
  const languageChosenLocally = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.fabrictradReady = 'true';
    return () => { delete document.documentElement.dataset.fabrictradReady; };
  }, []);

  useEffect(() => {
    let storedLanguage: string | null = null;
    try { storedLanguage = window.localStorage.getItem(LANGUAGE_KEY); } catch { /* Storage can be disabled. */ }
    if (isLanguage(storedLanguage)) setLanguageState(storedLanguage);

    // The current commerce release is intentionally light-only. This clears old
    // device/account dark preferences that produced low-contrast mixed surfaces.
    try { window.localStorage.setItem(THEME_KEY, 'light'); } catch { /* Keep the in-memory preference. */ }
    document.documentElement.classList.remove('dark');
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
  }, []);

  useEffect(() => {
    if (!user) profileLanguageLoadedFor.current = null;
    if (user && profile && profileLanguageLoadedFor.current !== user.id) {
      profileLanguageLoadedFor.current = user.id;
      if (!languageChosenLocally.current && isLanguage(profile.preferred_language)) {
        setLanguageState(profile.preferred_language);
        try { window.localStorage.setItem(LANGUAGE_KEY, profile.preferred_language); } catch { /* Optional device storage. */ }
      }
    }

    // Do not let a stale preferred_theme value reactivate the unaudited dark UI.
    try { window.localStorage.setItem(THEME_KEY, 'light'); } catch { /* Optional device storage. */ }
    document.documentElement.classList.remove('dark');
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
  }, [profile, user]);

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
      try { window.localStorage.setItem(THEME_KEY, 'light'); } catch { /* Optional device storage. */ }
      document.documentElement.classList.remove('dark');
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.colorScheme = 'light';
      void persistProfilePreference({ preferred_theme: 'light' }).catch(() => undefined);
    },
    [persistProfilePreference]
  );

  const setLanguage = useCallback(
    async (next: SupportedLanguageCode) => {
      if (!isLanguage(next)) return;
      languageChosenLocally.current = true;
      setLanguageState(next);
      try { window.localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Language switching still works for this visit. */ }
      // Serialize rapid selections so a slower earlier request cannot overwrite the latest choice.
      preferenceQueue.current = preferenceQueue.current.catch(() => undefined)
        .then(() => persistProfilePreference({ preferred_language: next }));
      await preferenceQueue.current.catch(() => undefined);
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
