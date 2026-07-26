export type ParsedWhatsAppCatalog = {
  name: string;
  fabric: string;
  category: string;
  widthInches: number | null;
  workType: string;
  pricePerUnit: number;
  unit: 'mtr' | 'kg' | 'piece' | 'roll';
  moq: number;
  availableQuantity: number;
  gsm: number | null;
  description: string;
};

const KEY_ALIASES: Record<string, string> = {
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
  design: 'work',
  rate: 'price',
  price: 'price',
  cost: 'price',
  moq: 'moq',
  'minimum order': 'moq',
  stock: 'available',
  available: 'available',
  quantity: 'available',
  gsm: 'gsm',
};

export function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length > 10 ? digits : digits;
}

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(' ');
}

function firstNumber(value: string) {
  const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function positiveInteger(value: string, fallback: number) {
  const parsed = firstNumber(value);
  if (parsed === null || !Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function inferUnit(value: string): ParsedWhatsAppCatalog['unit'] {
  const normalized = value.toLowerCase();
  if (/\bkg|kilogram/.test(normalized)) return 'kg';
  if (/\bpc\b|\bpcs\b|piece/.test(normalized)) return 'piece';
  if (/roll/.test(normalized)) return 'roll';
  return 'mtr';
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

export function parseWhatsAppCatalog(text: string): ParsedWhatsAppCatalog | null {
  const cleaned = text
    .replace(/^forwarded\s*/i, '')
    .replace(/\r/g, '')
    .trim();
  if (!cleaned) return null;

  const fields: Record<string, string> = {};
  const freeText: string[] = [];

  for (const rawLine of cleaned.split('\n')) {
    const line = rawLine.trim().replace(/^[•*\-]+\s*/, '');
    if (!line) continue;

    const match = line.match(/^([^:=]{2,40})\s*[:=]\s*(.+)$/);
    if (!match) {
      freeText.push(line);
      continue;
    }

    const rawKey = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
    const key = KEY_ALIASES[rawKey];
    if (key) fields[key] = match[2].trim();
    else freeText.push(line);
  }

  const fabric = fields.fabric?.trim();
  const price = fields.price ? firstNumber(fields.price) : null;
  if (!fabric || price === null || !Number.isFinite(price) || price <= 0) return null;

  const suppliedName = fields.name?.trim() || freeText[0]?.trim();
  const fabricLabel = titleCase(fabric);
  const name = suppliedName
    ? `${titleCase(suppliedName)} · ${fabricLabel}`.slice(0, 160)
    : `${fabricLabel} Fabric`.slice(0, 160);
  const width = fields.width ? firstNumber(fields.width) : null;
  const work = fields.work?.trim() || 'Plain';
  const gsm = fields.gsm ? positiveInteger(fields.gsm, 0) || null : null;

  return {
    name,
    fabric: fabricLabel,
    category: inferFabricCategory(fabric),
    widthInches: width && width > 0 ? width : null,
    workType: titleCase(work),
    pricePerUnit: price,
    unit: inferUnit(fields.price || ''),
    moq: fields.moq ? positiveInteger(fields.moq, 3) : 3,
    availableQuantity: fields.available ? Math.max(0, firstNumber(fields.available) || 0) : 0,
    gsm,
    description: cleaned.slice(0, 2000),
  };
}
