'use client';

import { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '@/lib/india';
import { useAppPreferences, type ThemePreference } from '@/contexts/AppPreferencesContext';

export default function PreferenceControls({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, theme, setTheme, resolvedTheme, t } = useAppPreferences();
  const [languageOpen, setLanguageOpen] = useState(false);

  const cycleTheme = () => {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    setTheme(order[(order.indexOf(theme) + 1) % order.length]);
  };

  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-1.5'}`}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setLanguageOpen((open) => !open)}
          className="flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-700 text-foreground shadow-sm transition hover:border-primary/40"
          aria-haspopup="listbox"
          aria-expanded={languageOpen}
          aria-label={t('preferences.language')}
        >
          <Icon name="LanguageIcon" size={17} className="text-primary" />
          {!compact && <span>{SUPPORTED_LANGUAGES.find((item) => item.code === language)?.label}</span>}
          <Icon name="ChevronDownIcon" size={13} className="text-muted-foreground" />
        </button>
        {languageOpen && (
          <>
            <button
              type="button"
              aria-label="Close language menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setLanguageOpen(false)}
            />
            <div className="absolute right-0 z-50 mt-2 max-h-80 w-52 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-2xl">
              <p className="px-3 pb-2 pt-1 text-xs font-800 uppercase tracking-wider text-muted-foreground">
                {t('preferences.language')}
              </p>
              {SUPPORTED_LANGUAGES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    void setLanguage(item.code as SupportedLanguageCode);
                    setLanguageOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    item.code === language
                      ? 'bg-primary/10 font-800 text-primary'
                      : 'text-foreground hover:bg-muted'
                  }`}
                  role="option"
                  aria-selected={item.code === language}
                >
                  <span>{item.label}</span>
                  {item.code === language && <Icon name="CheckIcon" size={15} />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={cycleTheme}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:border-primary/40 hover:text-primary"
        title={`${t('preferences.theme')}: ${theme}`}
        aria-label={`${t('preferences.theme')}: ${theme}`}
      >
        <Icon
          name={theme === 'system' ? 'ComputerDesktopIcon' : resolvedTheme === 'dark' ? 'MoonIcon' : 'SunIcon'}
          size={18}
        />
      </button>
    </div>
  );
}
