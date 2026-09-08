'use client';

import { useId } from 'react';
import Icon from '@/components/ui/AppIcon';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '@/lib/india';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

type PreferenceControlsProps = {
  compact?: boolean;
  source?: 'embedded' | 'fallback';
  menuPlacement?: 'down' | 'up';
};

export default function PreferenceControls({ compact = false, source = 'embedded' }: PreferenceControlsProps) {
  const { language, setLanguage, resolvedTheme, setTheme, t } = useAppPreferences();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <div className={`ft-language-picker ${compact ? 'is-compact' : ''}`} data-language-control={source}>
        <label htmlFor={id} className="sr-only">{t('preferences.language')}</label>
        <Icon name="LanguageIcon" size={19} className="pointer-events-none shrink-0 text-primary" />
        <select id={id} value={language} onChange={(event) => void setLanguage(event.target.value as SupportedLanguageCode)}>
          {SUPPORTED_LANGUAGES.map((item) => <option key={item.code} value={item.code} lang={item.code}>{item.label}</option>)}
        </select>
      </div>
      <button
        type="button"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className="ft-icon-button"
        aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Icon name={resolvedTheme === 'dark' ? 'SunIcon' : 'MoonIcon'} size={18} />
      </button>
    </div>
  );
}
