export type CatalogUnit = 'mtr' | 'kg' | 'piece' | 'roll';

export type ParsedWhatsAppVariant = {
  colorName: string;
  colorHex: string | null;
  designName: string;
  description: string;
  pricePerUnit: number;
  unit: CatalogUnit;
  availableQuantity: number;
  moq: number;
  photoLabel: string | null;
};

export type ParsedWhatsAppCatalog = {
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
  variants: ParsedWhatsAppVariant[];
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
  'color hex': 'color_hex',
  'colour hex': 'color_hex',
  hex: 'color_hex',
  photo: 'photo_label',
  image: 'photo_label',
  'photo label': 'photo_label',
};

export function normalizeWhatsAppPhone(value: string) {
  return value.replace(/\D/g, '');
}

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

function inferUnit(value: string): CatalogUnit {
  const normalized = value.toLowerCase();
  if (/\bkg\b|kilogram/.test(normalized)) return 'kg';
  if (/\bpc\b|\bpcs\b|piece/.test(normalized)) return 'piece';
  if (/roll/.test(normalized)) return 'roll';
  return 'mtr';
}

function normalizeHex(value?: string) {
  if (!value) return null;
  const candidate = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toUpperCase() : null;
}

export function inferFabricCategory(fabric: string) {
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

export function parseWhatsAppCatalog(text: string): ParsedWhatsAppCatalog | null {
  const cleaned = text
    .replace(/^forwarded\s*/i, '')
    .replace(/\r/g, '')
    .trim();
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

    if (currentVariant && ['price', 'available', 'moq', 'design', 'variant_description', 'color_hex', 'photo_label'].includes(key)) {
      currentVariant[key] = value;
    } else {
      parent[key] = value;
    }
  }
  pushVariant();

  const fabric = parent.fabric?.trim();
  if (!fabric) return null;

  const suppliedName = parent.name?.trim() || parent.catalog?.trim() || freeText[0]?.trim();
  const fabricLabel = titleCase(fabric);
  const name = suppliedName
    ? `${titleCase(suppliedName)} · ${fabricLabel}`.slice(0, 160)
    : `${fabricLabel} Fabric`.slice(0, 160);
  const defaultPrice = positiveNumber(parent.price, 0);
  const defaultUnit = inferUnit(parent.price || '');
  const defaultMoq = positiveNumber(parent.moq, 3);
  const defaultWork = titleCase(parent.work?.trim() || 'Plain');

  const variants = variantBlocks
    .map((fields): ParsedWhatsAppVariant | null => {
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
        unit: inferUnit(fields.price || parent.price || defaultUnit),
        availableQuantity: nonNegativeNumber(fields.available, 0),
        moq: positiveNumber(fields.moq, defaultMoq),
        photoLabel: fields.photo_label?.trim() || color,
      };
    })
    .filter((variant): variant is ParsedWhatsAppVariant => Boolean(variant));

  const fallbackPrice = defaultPrice || variants[0]?.pricePerUnit || 0;
  if (fallbackPrice <= 0) return null;

  const width = parent.width ? firstNumber(parent.width) : null;
  const gsm = parent.gsm ? positiveNumber(parent.gsm, 0) || null : null;
  const catalogKeySource = parent.catalog || suppliedName || fabricLabel;

  return {
    catalogKey: slug(catalogKeySource) || slug(fabricLabel),
    name,
    fabric: fabricLabel,
    category: inferFabricCategory(fabric),
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
    variants,
  };
}

export function variantKey(colorName: string, designName: string) {
  return slug(`${colorName}-${designName}`) || 'standard';
}
