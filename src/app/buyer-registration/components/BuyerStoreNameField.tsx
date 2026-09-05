'use client';

import { useEffect, useMemo, useState } from 'react';

type Suggestion = { storeName: string; handle: string };
type Availability = {
  available?: boolean;
  handle?: string;
  error?: string;
  message?: string;
  suggestions?: Suggestion[];
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function BuyerStoreNameField({ value, onChange, disabled = false }: Props) {
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const trimmed = useMemo(() => value.trim(), [value]);

  useEffect(() => {
    setAvailability(null);
    if (trimmed.length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setChecking(true);
      try {
        const response = await fetch(`/api/buyer/stores/availability?name=${encodeURIComponent(trimmed)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as Availability;
        if (!controller.signal.aborted) {
          setAvailability(
            response.ok || payload.error
              ? payload
              : { error: 'Could not check this name right now. Please try again.' }
          );
        }
      } catch (error) {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) {
          setAvailability({ error: 'Could not check this name right now.' });
        }
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  return (
    <div>
      <label className="block text-sm font-700 text-foreground" htmlFor="buyer-store-name">
        Store name *
      </label>
      <input
        id="buyer-store-name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        minLength={3}
        maxLength={80}
        autoComplete="organization"
        placeholder="e.g. Meera Textiles"
        className="input-base mt-1.5 w-full px-4 py-3 font-400"
        required
        aria-describedby="store-name-help store-name-status"
      />
      <p id="store-name-help" className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
        This is your public FabricTrad store identity. Store names are unique across FabricTrad.
      </p>
      <div id="store-name-status" aria-live="polite" className="mt-2 min-h-5 text-xs">
        {checking ? (
          <span className="text-muted-foreground">Checking availability…</span>
        ) : availability?.available ? (
          <span className="font-700 text-success">✓ Available · @{availability.handle}</span>
        ) : availability?.available === false ? (
          <span className="font-700 text-error">That name is already taken.</span>
        ) : availability?.error && trimmed.length >= 3 ? (
          <span className="text-error">{availability.error}</span>
        ) : null}
      </div>

      {availability?.available === false && (availability.suggestions?.length || 0) > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-xs font-700 text-foreground">Available suggestions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {availability.suggestions?.map((suggestion) => (
              <button
                key={suggestion.handle}
                type="button"
                disabled={disabled}
                onClick={() => onChange(suggestion.storeName)}
                className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-700 text-primary hover:bg-primary/15 disabled:opacity-50"
              >
                {suggestion.storeName} · @{suggestion.handle}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
