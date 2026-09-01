export type StoreNameSuggestion = {
  storeName: string;
  handle: string;
};

export const normalizeStoreName = (value: unknown) =>
  (typeof value === 'string' ? value : '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

export const storeKey = (value: unknown) =>
  normalizeStoreName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export const storeHandle = (value: unknown) =>
  normalizeStoreName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');

export const validateStoreName = (value: unknown) => {
  const storeName = normalizeStoreName(value);
  const key = storeKey(storeName);
  const handle = storeHandle(storeName);

  if (storeName.length < 3) {
    return { valid: false as const, error: 'Store name must be at least 3 characters.' };
  }
  if (storeName.length > 80) {
    return { valid: false as const, error: 'Store name must be 80 characters or fewer.' };
  }
  if (key.length < 3 || handle.length < 3) {
    return {
      valid: false as const,
      error: 'Store name needs at least 3 letters or numbers.',
    };
  }

  return { valid: true as const, storeName, key, handle };
};

export const storeSuggestionSeeds = (value: unknown): StoreNameSuggestion[] => {
  const base = normalizeStoreName(value) || 'Fabric Store';
  const seeds = [
    `${base} India`,
    `The ${base}`,
    `${base} Co`,
    `${base} Studio`,
    `${base} Textiles`,
    `${base} 01`,
    `${base} 91`,
  ];

  const seen = new Set<string>();
  return seeds
    .map((storeName) => ({ storeName, handle: storeHandle(storeName) }))
    .filter(({ storeName, handle }) => {
      const key = storeKey(storeName);
      if (!key || !handle || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
