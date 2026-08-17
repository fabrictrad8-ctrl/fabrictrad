'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Snapshot<T> = {
  payload: T;
  savedAt: string;
};

type Options<T> = {
  payload: T;
  onRestore: (payload: T, savedAt: string) => void;
  enabled?: boolean;
};

const KEY = 'fabrictrad:seller:catalog-composer:v1';

const write = <T,>(payload: T) => {
  const snapshot: Snapshot<T> = { payload, savedAt: new Date().toISOString() };
  const serialized = JSON.stringify(snapshot);
  try {
    window.localStorage.setItem(KEY, serialized);
  } catch {
    // A same-tab session copy is attempted below.
  }
  try {
    window.sessionStorage.setItem(KEY, serialized);
  } catch {
    // The composer remains usable even when browser storage is unavailable.
  }
  return snapshot.savedAt;
};

const readSnapshot = <T,>() => {
  const candidates: Snapshot<T>[] = [];
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = storage.getItem(KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Snapshot<T>;
      if (parsed?.payload && parsed.savedAt) candidates.push(parsed);
    } catch {
      // Ignore malformed or unavailable storage.
    }
  }
  return candidates.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0] || null;
};

export function useCatalogComposerDraft<T>({ payload, onRestore, enabled = true }: Options<T>) {
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const payloadRef = useRef(payload);
  const restoreRef = useRef(onRestore);
  const enabledRef = useRef(enabled);
  payloadRef.current = payload;
  restoreRef.current = onRestore;
  enabledRef.current = enabled;

  const saveNow = useCallback(() => {
    if (!loaded || !enabledRef.current) return;
    setSavedAt(write(payloadRef.current));
  }, [loaded]);

  useEffect(() => {
    const snapshot = readSnapshot<T>();
    if (snapshot) {
      restoreRef.current(snapshot.payload, snapshot.savedAt);
      setSavedAt(snapshot.savedAt);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !enabled) return;
    const timer = window.setTimeout(saveNow, 250);
    return () => window.clearTimeout(timer);
  }, [enabled, loaded, payload, saveNow]);

  useEffect(() => {
    if (!loaded) return;
    const visibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', saveNow);
    window.addEventListener('beforeunload', saveNow);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', saveNow);
      window.removeEventListener('beforeunload', saveNow);
    };
  }, [loaded, saveNow]);

  const clear = useCallback(() => {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        storage.removeItem(KEY);
      } catch {
        // Nothing else required.
      }
    }
    setSavedAt(null);
  }, []);

  return { loaded, savedAt, saveNow, clear };
}
