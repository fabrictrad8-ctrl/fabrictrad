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

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function applyResolvedTheme(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, isDemoAccount, refreshProfile } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguageCode>('en');
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const preferenceQueue = useRef<Promise<void>>(Promise.resolve());
  const profileLanguageLoadedFor = useRef<string | null>(null);
  const languageChosenLocally = useRef(false);
  const themeChosenLocally = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.fabrictradReady = 'true';
    return () => { delete document.documentElement.dataset.fabrictradReady; };
  }, []);

  useEffect(() => {
    let storedLanguage: string | null = null;
    let storedTheme: string | null = null;
    try {
      storedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
      storedTheme = window.localStorage.getItem(THEME_KEY);
    } catch { /* Storage can be disabled. */ }
    if (isLanguage(storedLanguage)) setLanguageState(storedLanguage);
    const initialTheme: ThemePreference =
      storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : 'system';
    if (storedTheme) themeChosenLocally.current = true;
    setThemeState(initialTheme);
    const resolved = initialTheme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : initialTheme;
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    let media: MediaQueryList;
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }
    const onChange = () => {
      const resolved = media.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => {
    if (!user) profileLanguageLoadedFor.current = null;
    if (user && profile && profileLanguageLoadedFor.current !== user.id) {
      profileLanguageLoadedFor.current = user.id;
      if (!languageChosenLocally.current && isLanguage(profile.preferred_language)) {
        setLanguageState(profile.preferred_language);
        try { window.localStorage.setItem(LANGUAGE_KEY, profile.preferred_language); } catch { /* Optional device storage. */ }
      }
      if (!themeChosenLocally.current) {
        const preferred = profile.preferred_theme;
        const next: ThemePreference =
          preferred === 'light' || preferred === 'dark' || preferred === 'system' ? preferred : 'system';
        setThemeState(next);
        const resolved = next === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : next;
        setResolvedTheme(resolved);
        applyResolvedTheme(resolved);
      }
    }
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
    (next: ThemePreference) => {
      themeChosenLocally.current = true;
      setThemeState(next);
      try { window.localStorage.setItem(THEME_KEY, next); } catch { /* Optional device storage. */ }
      const resolved = next === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : next;
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
      void persistProfilePreference({ preferred_theme: next }).catch(() => undefined);
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
      theme,
      resolvedTheme,
      language,
      setTheme,
      setLanguage,
      t: (key) => translate(language, key),
    }),
    [theme, resolvedTheme, language, setLanguage, setTheme]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  return context;
}
