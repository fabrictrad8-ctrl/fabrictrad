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

const keyFor = (flow: Flow) => `fabrictrad:${flow}:onboarding-draft:v4`;
const legacyKeyFor = (flow: Flow) => `fabrictrad:${flow}:onboarding-draft:v3`;

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Safari private mode / device storage pressure may reject localStorage.
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session storage is a secondary same-tab recovery layer only.
  }
};

export const saveOnboardingDraftLocally = <T,>(flow: Flow, step: string, payload: T) => {
  const envelope: DraftEnvelope<T> = {
    step,
    payload,
    savedAt: new Date().toISOString(),
  };
  writeStorage(keyFor(flow), JSON.stringify(envelope));
  return envelope;
};

export const clearOnboardingDraftLocally = (flow: Flow) => {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      storage.removeItem(keyFor(flow));
      storage.removeItem(legacyKeyFor(flow));
    } catch {
      // Nothing else required.
    }
  }
};

const parseStored = <T,>(storage: Storage, key: string): DraftEnvelope<T> | null => {
  try {
    const raw = storage.getItem(key);
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

const parseLocal = <T,>(flow: Flow): DraftEnvelope<T> | null => {
  const candidates: Array<DraftEnvelope<T> | null> = [];
  for (const storage of [window.localStorage, window.sessionStorage]) {
    candidates.push(parseStored<T>(storage, keyFor(flow)));
    candidates.push(parseStored<T>(storage, legacyKeyFor(flow)));
  }
  return candidates
    .filter((candidate): candidate is DraftEnvelope<T> => Boolean(candidate))
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0] || null;
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
  const stepRef = useRef(step);
  const enabledRef = useRef(enabled);
  const userIdRef = useRef(userId);
  restoreRef.current = onRestore;
  payloadRef.current = payload;
  stepRef.current = step;
  enabledRef.current = enabled;
  userIdRef.current = userId;

  const saveServerDraft = useCallback((keepalive = false) => {
    const currentUserId = userIdRef.current;
    const currentStep = stepRef.current;
    if (!currentUserId || !enabledRef.current || currentStep === 'done') return Promise.resolve();
    return fetch('/api/account/onboarding-draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive,
      body: JSON.stringify({ flow, step: currentStep, payload: payloadRef.current }),
    }).then(() => undefined).catch(() => undefined);
  }, [flow]);

  const saveNow = useCallback((keepalive = false) => {
    const currentStep = stepRef.current;
    if (!enabledRef.current || !loaded || currentStep === 'done') return;
    const envelope = saveOnboardingDraftLocally(flow, currentStep, payloadRef.current);
    setSavedAt(envelope.savedAt);
    void saveServerDraft(keepalive);
  }, [flow, loaded, saveServerDraft]);

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
    const timer = window.setTimeout(() => saveNow(false), 250);
    return () => window.clearTimeout(timer);
  }, [enabled, loaded, payload, saveNow, step]);

  // Mobile Chrome/Safari may freeze or evict a backgrounded page when the user
  // opens Gallery, Files, WhatsApp or a banking app. Flush synchronously before
  // the page is hidden, and use keepalive for the authenticated server copy.
  useEffect(() => {
    if (!loaded) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow(true);
    };
    const handlePageHide = () => saveNow(true);
    const handleBeforeUnload = () => saveNow(true);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [loaded, saveNow]);

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

  return { loaded, savedAt, clearDraft, saveNow };
}
