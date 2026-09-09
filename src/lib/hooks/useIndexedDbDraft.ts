'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Draft persistence for state too large for localStorage/sessionStorage —
 * a photo a buyer or seller just picked, held as a data URL, can be several
 * megabytes and blow past typical 5-10MB storage quotas on its own.
 * IndexedDB has no such practical ceiling and, unlike sessionStorage, isn't
 * cleared when a backgrounded tab gets discarded by the OS under memory
 * pressure (the exact scenario reported: switching to the gallery/camera
 * app to pick a photo, then coming back to find the page reloaded and the
 * selection gone). Saves on the same visibilitychange/pagehide signals
 * PageContinuity.tsx and useCatalogComposerDraft.ts already use elsewhere
 * in this app, restores once on mount, and self-clears once the caller
 * says the draft was consumed (submitted, or explicitly discarded).
 */

const DB_NAME = 'fabrictrad-drafts';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;
const MAX_DRAFT_AGE_MS = 12 * 60 * 60 * 1000;

type Snapshot<T> = { payload: T; savedAt: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<Snapshot<T> | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as Snapshot<T>) || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function idbSet<T>(key: string, snapshot: Snapshot<T>): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best-effort — a draft that can't be saved just means the user
    // re-does their selection, same as before this hook existed.
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Nothing else to do.
  }
}

type Options<T> = {
  key: string | null | undefined;
  payload: T;
  onRestore: (payload: T, savedAt: number) => void;
  enabled?: boolean;
};

export function useIndexedDbDraft<T>({ key, payload, onRestore, enabled = true }: Options<T>) {
  const [loaded, setLoaded] = useState(false);
  const payloadRef = useRef(payload);
  const restoreRef = useRef(onRestore);
  const enabledRef = useRef(enabled);
  const keyRef = useRef(key || '');
  payloadRef.current = payload;
  restoreRef.current = onRestore;
  enabledRef.current = enabled;
  keyRef.current = key || '';

  const saveNow = useCallback(() => {
    const currentKey = keyRef.current;
    if (!currentKey || !enabledRef.current) return;
    void idbSet(currentKey, { payload: payloadRef.current, savedAt: Date.now() });
  }, []);

  const clear = useCallback(() => {
    const currentKey = keyRef.current;
    if (!currentKey) return;
    void idbDelete(currentKey);
  }, []);

  useEffect(() => {
    if (!key || typeof indexedDB === 'undefined') {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void idbGet<T>(key).then((snapshot) => {
      if (cancelled) return;
      if (snapshot && Date.now() - snapshot.savedAt < MAX_DRAFT_AGE_MS) {
        restoreRef.current(snapshot.payload, snapshot.savedAt);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // Deliberately re-runs only when the draft's owner key changes.
  }, [key]);

  useEffect(() => {
    if (!loaded || !key) return;
    const timer = window.setTimeout(saveNow, 400);
    return () => window.clearTimeout(timer);
  }, [loaded, key, payload, saveNow]);

  useEffect(() => {
    if (!loaded || !key) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', saveNow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', saveNow);
    };
  }, [loaded, key, saveNow]);

  return { loaded, saveNow, clear };
}
