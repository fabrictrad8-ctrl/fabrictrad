export type CatalogUnit = 'mtr' | 'kg' | 'piece' | 'roll';
export type SaleChannel = 'b2b' | 'retail' | 'both';
export type PackageFormat =
  | 'Fabric Only'
  | 'Full Set'
  | 'Top'
  | 'Bottom'
  | 'Top & Bottom'
  | 'Additional Accessory'
  | 'Other';

export type ParsedCatalogVariant = {
  colorName: string;
  colorHex: string | null;
  designName: string;
  description: string;
  pricePerUnit: number;
  unit: CatalogUnit;
  availableQuantity: number;
  moq: number;
  mediaLabel: string | null;
};

export type ParsedCatalogDraft = {
  catalogKey: string;
  name: string;
  fabric: string;
  category: string;
  widthInches: number | null;
  workType: string;
  pricePerUnit: number;
  unit: CatalogUnit;
  moq: number;
  availableQuantity: number;
  gsm: number | null;
  description: string;
  saleChannel: SaleChannel;
  packageFormat: PackageFormat;
  variants: ParsedCatalogVariant[];
};

const KEY_ALIASES: Record<string, string> = {
  catalog: 'catalog',
  collection: 'catalog',
  group: 'catalog',
  fabric: 'fabric',
  'fabric type': 'fabric',
  material: 'fabric',
  cloth: 'fabric',
  name: 'name',
  title: 'name',
  product: 'name',
  category: 'category',
  type: 'category',
  width: 'width',
  'width in inches': 'width',
  work: 'work',
  'work type': 'work',
  rate: 'price',
  price: 'price',
  cost: 'price',
  'default rate': 'price',
  moq: 'moq',
  'minimum order': 'moq',
  stock: 'available',
  available: 'available',
  quantity: 'available',
  metres: 'available',
  meters: 'available',
  mtrs: 'available',
  gsm: 'gsm',
  variant: 'variant',
  color: 'variant',
  colour: 'variant',
  shade: 'variant',
  design: 'design',
  pattern: 'design',
  'variant description': 'variant_description',
  'color details': 'variant_description',
  'colour details': 'variant_description',
  details: 'variant_description',
  'color hex': 'color_hex',
  'colour hex': 'color_hex',
  hex: 'color_hex',
  photo: 'media_label',
  image: 'media_label',
  media: 'media_label',
  'photo label': 'media_label',
  channel: 'sale_channel',
  market: 'sale_channel',
  selling: 'sale_channel',
  'sale channel': 'sale_channel',
  'customer type': 'sale_channel',
  format: 'package_format',
  'unit format': 'package_format',
  'product format': 'package_format',
  package: 'package_format',
  set: 'package_format',
};

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(' ');
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function firstNumber(value: string) {
  const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = value ? firstNumber(value) : null;
  if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function nonNegativeNumber(value: string | undefined, fallback: number) {
  const parsed = value ? firstNumber(value) : null;
  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function inferCatalogUnit(value: string): CatalogUnit {
  const normalized = value.toLowerCase();
  if (/\bkg\b|kilogram/.test(normalized)) return 'kg';
  if (/\bpc\b|\bpcs\b|piece/.test(normalized)) return 'piece';
  if (/roll/.test(normalized)) return 'roll';
  return 'mtr';
}

function normalizeHex(value?: string | null) {
  if (!value) return null;
  const candidate = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toUpperCase() : null;
}

export function inferCatalogCategory(fabric: string) {
  const normalized = fabric.toLowerCase();
  if (normalized.includes('silk')) return 'Silk';
  if (normalized.includes('cotton')) return 'Cotton';
  if (normalized.includes('net')) return 'Net & Netting';
  if (normalized.includes('georgette')) return 'Georgette';
  if (normalized.includes('organza')) return 'Organza';
  if (normalized.includes('velvet')) return 'Velvet';
  if (normalized.includes('linen')) return 'Linen';
  if (normalized.includes('denim')) return 'Denim';
  if (normalized.includes('wool')) return 'Wool';
  if (normalized.includes('polyester') || normalized.includes('crepe')) return 'Polyester';
  if (normalized.includes('khadi') || normalized.includes('handloom')) return 'Handloom';
  if (normalized.includes('lace')) return 'Lace';
  if (normalized.includes('satin')) return 'Satin';
  return 'Other';
}

export function normalizeSaleChannel(value?: string | null): SaleChannel {
  const normalized = (value || '').toLowerCase();
  if (/both|b2b.*b2c|b2c.*b2b|wholesale.*retail|retail.*wholesale/.test(normalized)) return 'both';
  if (/retail|b2c|consumer|single piece/.test(normalized)) return 'retail';
  return 'b2b';
}

export function normalizePackageFormat(value?: string | null): PackageFormat {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized || /fabric only|loose fabric|material/.test(normalized)) return 'Fabric Only';
  if (/full set|complete set/.test(normalized)) return 'Full Set';
  if (/top.*bottom|bottom.*top|pair|co-?ord/.test(normalized)) return 'Top & Bottom';
  if (/^top$|top only|shirt|kurta/.test(normalized)) return 'Top';
  if (/^bottom$|bottom only|trouser|pant|skirt/.test(normalized)) return 'Bottom';
  if (/accessor|dupatta|scarf|belt|add-on/.test(normalized)) return 'Additional Accessory';
  return 'Other';
}

type VariantFields = Record<string, string>;

function compactVariant(line: string): VariantFields | null {
  if (!line.includes('|')) return null;
  const parts = line.split('|').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const [color, stock, price, design] = parts;
  if (!color || firstNumber(stock || '') === null) return null;
  return {
    variant: color,
    available: stock || '0',
    price: price || '',
    design: design || 'Standard',
  };
}

export function parseCatalogMessage(text: string): ParsedCatalogDraft | null {
  const cleaned = text.replace(/^forwarded\s*/i, '').replace(/\r/g, '').trim();
  if (!cleaned) return null;

  const parent: Record<string, string> = {};
  const freeText: string[] = [];
  const variantBlocks: VariantFields[] = [];
  let currentVariant: VariantFields | null = null;

  const pushVariant = () => {
    if (currentVariant?.variant?.trim()) variantBlocks.push(currentVariant);
    currentVariant = null;
  };

  for (const rawLine of cleaned.split('\n')) {
    const line = rawLine.trim().replace(/^[•*\-]+\s*/, '');
    if (!line) continue;

    const compact = compactVariant(line);
    if (compact) {
      pushVariant();
      variantBlocks.push(compact);
      continue;
    }

    const match = line.match(/^([^:=]{2,40})\s*[:=]\s*(.+)$/);
    if (!match) {
      freeText.push(line);
      continue;
    }

    const rawKey = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
    const key = KEY_ALIASES[rawKey];
    const value = match[2].trim();
    if (!key) {
      freeText.push(line);
      continue;
    }

    if (key === 'variant') {
      pushVariant();
      currentVariant = { variant: value };
      continue;
    }

    if (
      currentVariant &&
      ['price', 'available', 'moq', 'design', 'variant_description', 'color_hex', 'media_label'].includes(key)
    ) {
      currentVariant[key] = value;
    } else {
      parent[key] = value;
    }
  }
  pushVariant();

  const fabric = parent.fabric?.trim() || parent.name?.trim() || parent.catalog?.trim();
  if (!fabric) return null;

  const suppliedName = parent.name?.trim() || parent.catalog?.trim() || freeText[0]?.trim();
  const fabricLabel = titleCase(fabric);
  const name = suppliedName ? titleCase(suppliedName).slice(0, 160) : `${fabricLabel} Fabric`.slice(0, 160);
  const defaultPrice = positiveNumber(parent.price, 0);
  const defaultUnit = inferCatalogUnit(parent.price || parent.available || '');
  const defaultMoq = positiveNumber(parent.moq, 3);
  const defaultWork = titleCase(parent.work?.trim() || 'Plain');

  const variants = variantBlocks
    .map((fields): ParsedCatalogVariant | null => {
      const color = fields.variant?.trim();
      if (!color) return null;
      const price = positiveNumber(fields.price, defaultPrice);
      if (price <= 0) return null;
      return {
        colorName: titleCase(color),
        colorHex: normalizeHex(fields.color_hex),
        designName: titleCase(fields.design?.trim() || defaultWork || 'Standard'),
        description: (fields.variant_description || '').trim().slice(0, 1000),
        pricePerUnit: price,
        unit: inferCatalogUnit(fields.price || fields.available || parent.price || defaultUnit),
        availableQuantity: nonNegativeNumber(fields.available, 0),
        moq: positiveNumber(fields.moq, defaultMoq),
        mediaLabel: fields.media_label?.trim() || color,
      };
    })
    .filter((variant): variant is ParsedCatalogVariant => Boolean(variant));

  const fallbackPrice = defaultPrice || variants[0]?.pricePerUnit || 0;
  if (fallbackPrice <= 0) return null;

  const width = parent.width ? firstNumber(parent.width) : null;
  const gsm = parent.gsm ? positiveNumber(parent.gsm, 0) || null : null;
  const catalogKeySource = parent.catalog || suppliedName || fabricLabel;
  const explicitCategory = parent.category?.trim();

  return {
    catalogKey: slug(catalogKeySource) || slug(fabricLabel),
    name,
    fabric: fabricLabel,
    category: explicitCategory ? titleCase(explicitCategory) : inferCatalogCategory(fabric),
    widthInches: width && width > 0 ? width : null,
    workType: defaultWork,
    pricePerUnit: fallbackPrice,
    unit: defaultUnit,
    moq: defaultMoq,
    availableQuantity: variants.length
      ? variants.reduce((sum, variant) => sum + variant.availableQuantity, 0)
      : nonNegativeNumber(parent.available, 0),
    gsm,
    description: cleaned.slice(0, 3000),
    saleChannel: normalizeSaleChannel(parent.sale_channel),
    packageFormat: normalizePackageFormat(parent.package_format),
    variants,
  };
}

export function normalizeAiCatalogDraft(value: unknown, fallbackText: string): ParsedCatalogDraft | null {
  if (!value || typeof value !== 'object') return parseCatalogMessage(fallbackText);
  const raw = value as Record<string, unknown>;
  const variantsRaw = Array.isArray(raw.variants) ? raw.variants : [];
  const fabric = String(raw.fabric || raw.name || '').trim();
  const price = Number(raw.pricePerUnit || 0);
  if (!fabric || !Number.isFinite(price) || price <= 0) return parseCatalogMessage(fallbackText);

  const variants: ParsedCatalogVariant[] = variantsRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const colorName = String(item.colorName || '').trim();
      const variantPrice = Number(item.pricePerUnit || price);
      if (!colorName || !Number.isFinite(variantPrice) || variantPrice <= 0) return null;
      return {
        colorName: titleCase(colorName),
        colorHex: normalizeHex(item.colorHex ? String(item.colorHex) : null),
        designName: titleCase(String(item.designName || raw.workType || 'Standard')),
        description: String(item.description || '').trim().slice(0, 1000),
        pricePerUnit: variantPrice,
        unit: inferCatalogUnit(String(item.unit || raw.unit || 'mtr')),
        availableQuantity: Math.max(0, Number(item.availableQuantity || 0)),
        moq: Math.max(0.01, Number(item.moq || raw.moq || 1)),
        mediaLabel: String(item.mediaLabel || colorName),
      } satisfies ParsedCatalogVariant;
    })
    .filter((item): item is ParsedCatalogVariant => Boolean(item));

  const name = titleCase(String(raw.name || `${fabric} Fabric`)).slice(0, 160);
  const unit = inferCatalogUnit(String(raw.unit || 'mtr'));
  return {
    catalogKey: slug(String(raw.catalogKey || name || fabric)),
    name,
    fabric: titleCase(fabric),
    category: titleCase(String(raw.category || inferCatalogCategory(fabric))),
    widthInches: raw.widthInches ? Number(raw.widthInches) : null,
    workType: titleCase(String(raw.workType || 'Plain')),
    pricePerUnit: price,
    unit,
    moq: Math.max(0.01, Number(raw.moq || 1)),
    availableQuantity: variants.length
      ? variants.reduce((sum, variant) => sum + variant.availableQuantity, 0)
      : Math.max(0, Number(raw.availableQuantity || 0)),
    gsm: raw.gsm ? Number(raw.gsm) : null,
    description: String(raw.description || fallbackText).trim().slice(0, 3000),
    saleChannel: normalizeSaleChannel(String(raw.saleChannel || 'b2b')),
    packageFormat: normalizePackageFormat(String(raw.packageFormat || 'Fabric Only')),
    variants,
  };
}

export function catalogVariantKey(colorName: string, designName: string) {
  return slug(`${colorName}-${designName}`) || 'standard';
}
