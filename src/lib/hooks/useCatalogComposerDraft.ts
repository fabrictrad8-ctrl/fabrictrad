'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Snapshot<T> = {
  payload: T;
  savedAt: string;
};

type Options<T> = {
  ownerKey: string | null | undefined;
  payload: T;
  onRestore: (payload: T, savedAt: string) => void;
  enabled?: boolean;
};

const keyFor = (ownerKey: string) => `fabrictrad:seller:catalog-composer:v1:${ownerKey}`;

const write = <T,>(key: string, payload: T) => {
  const snapshot: Snapshot<T> = { payload, savedAt: new Date().toISOString() };
  const serialized = JSON.stringify(snapshot);
  try {
    window.localStorage.setItem(key, serialized);
  } catch {
    // A same-tab session copy is attempted below.
  }
  try {
    window.sessionStorage.setItem(key, serialized);
  } catch {
    // The composer remains usable even when browser storage is unavailable.
  }
  return snapshot.savedAt;
};

const readSnapshot = <T,>(key: string) => {
  const candidates: Snapshot<T>[] = [];
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Snapshot<T>;
      if (parsed?.payload && parsed.savedAt) candidates.push(parsed);
    } catch {
      // Ignore malformed or unavailable storage.
    }
  }
  return candidates.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0] || null;
};

export function useCatalogComposerDraft<T>({
  ownerKey,
  payload,
  onRestore,
  enabled = true,
}: Options<T>) {
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const payloadRef = useRef(payload);
  const restoreRef = useRef(onRestore);
  const enabledRef = useRef(enabled);
  const ownerRef = useRef(ownerKey || '');
  payloadRef.current = payload;
  restoreRef.current = onRestore;
  enabledRef.current = enabled;
  ownerRef.current = ownerKey || '';

  const saveNow = useCallback(() => {
    const owner = ownerRef.current;
    if (!owner || !loaded || !enabledRef.current) return;
    setSavedAt(write(keyFor(owner), payloadRef.current));
  }, [loaded]);

  useEffect(() => {
    if (!ownerKey) {
      setLoaded(false);
      setSavedAt(null);
      return;
    }
    const snapshot = readSnapshot<T>(keyFor(ownerKey));
    if (snapshot) {
      restoreRef.current(snapshot.payload, snapshot.savedAt);
      setSavedAt(snapshot.savedAt);
    } else {
      setSavedAt(null);
    }
    setLoaded(true);
  }, [ownerKey]);

  useEffect(() => {
    if (!loaded || !enabled || !ownerKey) return;
    const timer = window.setTimeout(saveNow, 250);
    return () => window.clearTimeout(timer);
  }, [enabled, loaded, ownerKey, payload, saveNow]);

  useEffect(() => {
    if (!loaded || !ownerKey) return;
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
  }, [loaded, ownerKey, saveNow]);

  const clear = useCallback(() => {
    const owner = ownerRef.current;
    if (!owner) return;
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        storage.removeItem(keyFor(owner));
      } catch {
        // Nothing else required.
      }
    }
    setSavedAt(null);
  }, []);

  return { loaded, savedAt, saveNow, clear };
}
