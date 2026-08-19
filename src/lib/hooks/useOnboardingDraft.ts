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
  accessToken?: string | null;
  step: string;
  payload: T;
  enabled?: boolean;
  onRestore: (draft: DraftEnvelope<T>) => void;
};

const scopeFor = (userId?: string | null) => userId || 'anonymous';
const keyFor = (flow: Flow, userId?: string | null) =>
  `fabrictrad:${flow}:onboarding-draft:${scopeFor(userId)}:v5`;
const legacyKeyFor = (flow: Flow, version: 'v4' | 'v3') =>
  `fabrictrad:${flow}:onboarding-draft:${version}`;

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Browser storage can be unavailable in private mode or under storage pressure.
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session storage is a secondary same-tab recovery layer only.
  }
};

export const saveOnboardingDraftLocally = <T,>(
  flow: Flow,
  userId: string | null | undefined,
  step: string,
  payload: T
) => {
  const envelope: DraftEnvelope<T> = {
    step,
    payload,
    savedAt: new Date().toISOString(),
  };
  writeStorage(keyFor(flow, userId), JSON.stringify(envelope));
  return envelope;
};

export const clearOnboardingDraftLocally = (flow: Flow, userId?: string | null) => {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      storage.removeItem(keyFor(flow, userId));
      // Clear old unscoped drafts so a previous account cannot overwrite this user.
      storage.removeItem(legacyKeyFor(flow, 'v4'));
      storage.removeItem(legacyKeyFor(flow, 'v3'));
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

const parseLocal = <T,>(flow: Flow, userId?: string | null): DraftEnvelope<T> | null => {
  const candidates: Array<DraftEnvelope<T> | null> = [];
  for (const storage of [window.localStorage, window.sessionStorage]) {
    candidates.push(parseStored<T>(storage, keyFor(flow, userId)));
    // Only anonymous onboarding may inherit the old unscoped draft. Authenticated
    // users must never receive another account's browser draft.
    if (!userId) {
      candidates.push(parseStored<T>(storage, legacyKeyFor(flow, 'v4')));
      candidates.push(parseStored<T>(storage, legacyKeyFor(flow, 'v3')));
    }
  }
  return (
    candidates
      .filter((candidate): candidate is DraftEnvelope<T> => Boolean(candidate))
      .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0] || null
  );
};

const errorMessageFromResponse = async (response: Response, fallback: string) => {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error || fallback;
};

export function useOnboardingDraft<T>({
  flow,
  userId,
  accessToken,
  step,
  payload,
  enabled = true,
  onRestore,
}: Options<T>) {
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const restoreRef = useRef(onRestore);
  const payloadRef = useRef(payload);
  const stepRef = useRef(step);
  const enabledRef = useRef(enabled);
  const userIdRef = useRef(userId);
  const accessTokenRef = useRef(accessToken);
  restoreRef.current = onRestore;
  payloadRef.current = payload;
  stepRef.current = step;
  enabledRef.current = enabled;
  userIdRef.current = userId;
  accessTokenRef.current = accessToken;

  const requestHeaders = useCallback((json = false) => {
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    const token = accessTokenRef.current;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, []);

  const saveServerDraft = useCallback(
    async (keepalive = false) => {
      const currentUserId = userIdRef.current;
      const currentStep = stepRef.current;
      if (!currentUserId || !enabledRef.current || currentStep === 'done') return;

      const response = await fetch('/api/account/onboarding-draft', {
        method: 'PUT',
        headers: requestHeaders(true),
        credentials: 'same-origin',
        cache: 'no-store',
        keepalive,
        body: JSON.stringify({ flow, step: currentStep, payload: payloadRef.current }),
      });
      if (!response.ok) {
        throw new Error(
          await errorMessageFromResponse(response, 'FabricTrad cloud autosave could not be completed.')
        );
      }
      setSaveError(null);
    },
    [flow, requestHeaders]
  );

  const saveNow = useCallback(
    (keepalive = false) => {
      const currentStep = stepRef.current;
      if (!enabledRef.current || !loaded || currentStep === 'done') return;

      const envelope = saveOnboardingDraftLocally(
        flow,
        userIdRef.current,
        currentStep,
        payloadRef.current
      );
      setSavedAt(envelope.savedAt);
      void saveServerDraft(keepalive).catch((error) => {
        setSaveError(
          error instanceof Error ? error.message : 'FabricTrad cloud autosave could not be completed.'
        );
      });
    },
    [flow, loaded, saveServerDraft]
  );

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const local = parseLocal<T>(flow, userId);
      let server: DraftEnvelope<T> | null = null;

      if (userId) {
        try {
          const response = await fetch(`/api/account/onboarding-draft?flow=${flow}`, {
            headers: requestHeaders(false),
            credentials: 'same-origin',
            cache: 'no-store',
          });
          const result = (await response.json().catch(() => ({}))) as {
            draft?: { step?: string; payload?: T; updated_at?: string } | null;
            error?: string;
          };
          if (response.ok && result.draft?.step && result.draft.payload) {
            server = {
              step: result.draft.step,
              payload: result.draft.payload,
              savedAt: result.draft.updated_at || new Date().toISOString(),
            };
          } else if (!response.ok) {
            setSaveError(result.error || 'FabricTrad cloud autosave could not be loaded.');
          }
        } catch {
          // Local restoration remains available while temporarily offline.
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
  }, [flow, requestHeaders, userId]);

  useEffect(() => {
    if (!enabled || !loaded || step === 'done') return;
    const timer = window.setTimeout(() => saveNow(false), 250);
    return () => window.clearTimeout(timer);
  }, [enabled, loaded, payload, saveNow, step]);

  // Flush the local copy synchronously before a mobile browser freezes or evicts
  // the page. The server copy is sent with keepalive and the current bearer token.
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
    clearOnboardingDraftLocally(flow, userId);
    setSavedAt(null);
    setSaveError(null);
    if (userId) {
      const response = await fetch(`/api/account/onboarding-draft?flow=${flow}`, {
        method: 'DELETE',
        headers: requestHeaders(false),
        credentials: 'same-origin',
        cache: 'no-store',
      }).catch(() => null);
      if (response && !response.ok) {
        setSaveError(
          await errorMessageFromResponse(response, 'The saved onboarding draft could not be cleared.')
        );
      }
    }
  }, [flow, requestHeaders, userId]);

  return { loaded, savedAt, saveError, clearDraft, saveNow };
}
