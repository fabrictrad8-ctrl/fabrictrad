'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CatalogMediaDraftItem = {
  id: string;
  file: File;
  mediaType: 'image' | 'video';
  durationSeconds: number | null;
  viewType: 'front' | 'back' | 'detail' | 'reel' | 'other';
  targetKey: string;
};

type StoredDraft = {
  key: string;
  items: CatalogMediaDraftItem[];
  savedAt: string;
};

const DB_NAME = 'fabrictrad-seller-drafts';
const DB_VERSION = 1;
const STORE = 'catalog-media';
const MAX_PERSISTED_BYTES = 160 * 1024 * 1024;
const draftKey = (ownerKey: string) => `catalog:${ownerKey}`;

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
  });

const readDraft = async (key: string): Promise<StoredDraft | null> => {
  const database = await openDb();
  try {
    return await new Promise<StoredDraft | null>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as StoredDraft | undefined) || null);
      request.onerror = () => reject(request.error || new Error('Unable to read media draft'));
    });
  } finally {
    database.close();
  }
};

const writeDraft = async (key: string, items: CatalogMediaDraftItem[]) => {
  const totalBytes = items.reduce((sum, item) => sum + Number(item.file?.size || 0), 0);
  if (totalBytes > MAX_PERSISTED_BYTES) {
    throw new Error('Selected media is too large to keep as a browser recovery draft.');
  }
  const database = await openDb();
  try {
    const savedAt = new Date().toISOString();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to save media draft'));
      transaction.objectStore(STORE).put({ key, items, savedAt } satisfies StoredDraft);
    });
    return savedAt;
  } finally {
    database.close();
  }
};

const deleteDraft = async (key: string) => {
  const database = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Unable to clear media draft'));
      transaction.objectStore(STORE).delete(key);
    });
  } finally {
    database.close();
  }
};

export function useCatalogMediaDraft({
  ownerKey,
  items,
  onRestore,
  enabled = true,
}: {
  ownerKey: string | null | undefined;
  items: CatalogMediaDraftItem[];
  onRestore: (items: CatalogMediaDraftItem[], savedAt: string) => void;
  enabled?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [warning, setWarning] = useState('');
  const itemsRef = useRef(items);
  const restoreRef = useRef(onRestore);
  const ownerRef = useRef(ownerKey || '');
  itemsRef.current = items;
  restoreRef.current = onRestore;
  ownerRef.current = ownerKey || '';

  const persist = useCallback(async (nextItems = itemsRef.current) => {
    const owner = ownerRef.current;
    if (!owner || !enabled || !loaded) return;
    const key = draftKey(owner);
    if (!nextItems.length) {
      await deleteDraft(key).catch(() => undefined);
      setSavedAt(null);
      return;
    }
    try {
      if (navigator.storage?.persist) {
        void navigator.storage.persist().catch(() => false);
      }
      const timestamp = await writeDraft(key, nextItems);
      setSavedAt(timestamp);
      setWarning('');
    } catch (error) {
      setWarning(
        error instanceof Error
          ? error.message
          : 'This browser could not keep selected media for recovery.'
      );
    }
  }, [enabled, loaded]);

  useEffect(() => {
    let cancelled = false;
    if (!ownerKey) {
      setLoaded(false);
      setSavedAt(null);
      return () => {
        cancelled = true;
      };
    }

    void readDraft(draftKey(ownerKey))
      .then((stored) => {
        if (cancelled || !stored?.items?.length) return;
        const validItems = stored.items.filter(
          (item) => item?.file instanceof File && item.file.size > 0
        );
        if (!validItems.length) return;
        restoreRef.current(validItems, stored.savedAt);
        setSavedAt(stored.savedAt);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerKey]);

  useEffect(() => {
    if (!loaded || !enabled || !ownerKey) return;
    const timer = window.setTimeout(() => void persist(items), 120);
    return () => window.clearTimeout(timer);
  }, [enabled, items, loaded, ownerKey, persist]);

  useEffect(() => {
    if (!loaded || !enabled || !ownerKey) return;
    const visibility = () => {
      if (document.visibilityState === 'hidden') void persist();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [enabled, loaded, ownerKey, persist]);

  const clear = useCallback(async () => {
    const owner = ownerRef.current;
    if (!owner) return;
    await deleteDraft(draftKey(owner)).catch(() => undefined);
    setSavedAt(null);
    setWarning('');
  }, []);

  return { loaded, savedAt, warning, persist, clear };
}
