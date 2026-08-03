'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Flow = 'buyer' | 'seller';
export type DraftEnvelope<T> = {
  step: string;
  payload: T;
  savedAt: string;
};

type Options<T> = {
  flow: Flow;
  userId?: string | null;
  step: string;
  payload: T;
  enabled?: boolean;
  onRestore: (draft: DraftEnvelope<T>) => void;
};

const keyFor = (flow: Flow) => `fabrictrad:${flow}:onboarding-draft:v3`;

export const saveOnboardingDraftLocally = <T,>(flow: Flow, step: string, payload: T) => {
  const envelope: DraftEnvelope<T> = {
    step,
    payload,
    savedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(keyFor(flow), JSON.stringify(envelope));
  } catch {
    // The server-backed draft remains available after authentication.
  }
  return envelope;
};

export const clearOnboardingDraftLocally = (flow: Flow) => {
  try {
    window.localStorage.removeItem(keyFor(flow));
  } catch {
    // Nothing else required.
  }
};

const parseLocal = <T,>(flow: Flow): DraftEnvelope<T> | null => {
  try {
    const raw = window.localStorage.getItem(keyFor(flow));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || typeof parsed.step !== 'string' || !parsed.payload || typeof parsed.payload !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export function useOnboardingDraft<T>({
  flow,
  userId,
  step,
  payload,
  enabled = true,
  onRestore,
}: Options<T>) {
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const restoreRef = useRef(onRestore);
  const payloadRef = useRef(payload);
  restoreRef.current = onRestore;
  payloadRef.current = payload;

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const local = parseLocal<T>(flow);
      let server: DraftEnvelope<T> | null = null;

      if (userId) {
        try {
          const response = await fetch(`/api/account/onboarding-draft?flow=${flow}`, {
            credentials: 'same-origin',
            cache: 'no-store',
          });
          const result = (await response.json().catch(() => ({}))) as {
            draft?: { step?: string; payload?: T; updated_at?: string } | null;
          };
          if (response.ok && result.draft?.step && result.draft.payload) {
            server = {
              step: result.draft.step,
              payload: result.draft.payload,
              savedAt: result.draft.updated_at || new Date().toISOString(),
            };
          }
        } catch {
          // Local restoration remains available while offline.
        }
      }

      if (cancelled) return;
      const selected =
        server && (!local || Date.parse(server.savedAt) >= Date.parse(local.savedAt)) ? server : local;
      if (selected) {
        restoreRef.current(selected);
        setSavedAt(selected.savedAt);
      }
      setLoaded(true);
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [flow, userId]);

  useEffect(() => {
    if (!enabled || !loaded || step === 'done') return;
    const timer = window.setTimeout(async () => {
      const envelope = saveOnboardingDraftLocally(flow, step, payloadRef.current);
      setSavedAt(envelope.savedAt);

      if (userId) {
        await fetch('/api/account/onboarding-draft', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ flow, step, payload: payloadRef.current }),
        }).catch(() => undefined);
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [enabled, flow, loaded, step, userId, payload]);

  const clearDraft = useCallback(async () => {
    clearOnboardingDraftLocally(flow);
    setSavedAt(null);
    if (userId) {
      await fetch(`/api/account/onboarding-draft?flow=${flow}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-store',
      }).catch(() => undefined);
    }
  }, [flow, userId]);

  return { loaded, savedAt, clearDraft };
}
