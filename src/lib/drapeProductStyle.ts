export type DrapeProductStyle =
  | 'saree' |'lehenga' |'kurta' |'shirt' |'dress' |'dupatta' |'top' |'bottom' |'set' |'fabric';

type DrapeProductInput = {
  name?: string | null;
  category?: string | null;
  description?: string | null;
  work?: string | null;
  packageFormat?: string | null;
};

const STYLE_LABELS: Record<DrapeProductStyle, string> = {
  saree: 'Saree',
  lehenga: 'Lehenga',
  kurta: 'Kurta',
  shirt: 'Shirt',
  dress: 'Dress',
  dupatta: 'Dupatta',
  top: 'Top',
  bottom: 'Bottom',
  set: 'Co-ordinated set',
  fabric: 'Fabric drape',
};

export function inferDrapeProductStyle(input: DrapeProductInput): DrapeProductStyle {
  const text = [input.name, input.category, input.description, input.work, input.packageFormat]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\bsaree\b|\bsari\b/.test(text)) return 'saree';
  if (/\blehenga\b|\bghagra\b/.test(text)) return 'lehenga';
  if (/\bdupatta\b|\bstole\b|\bscarf\b/.test(text)) return 'dupatta';
  if (/\bkurta\b|\bkurti\b|\bkameez\b/.test(text)) return 'kurta';
  if (/\bshirt\b|\bshirting\b/.test(text)) return 'shirt';
  if (/\bdress\b|\bgown\b|\bfrock\b/.test(text)) return 'dress';

  const format = String(input.packageFormat || '').toLowerCase();
  if (format === 'full set' || format === 'top & bottom') return 'set';
  if (format === 'top') return 'top';
  if (format === 'bottom') return 'bottom';

  return 'fabric';
}

export function drapeProductStyleLabel(style: DrapeProductStyle) {
  return STYLE_LABELS[style];
}

export function drapeProductStylePrompt(style: DrapeProductStyle) {
  const prompts: Record<DrapeProductStyle, string> = {
    saree:
      'a complete saree using this exact listed textile, with a fitted blouse, realistic waist pleats and a naturally falling pallu',
    lehenga:
      'a complete lehenga made from this exact listed textile, with a fitted blouse, full skirt and coordinated drape',
    kurta:
      'a properly tailored kurta made from this exact listed textile, with finished neckline, sleeves, side seams and natural folds',
    shirt:
      'a premium tailored shirt made from this exact listed textile, with collar, buttons, cuffs and anatomically correct seams',
    dress:
      'a wearable dress made from this exact listed textile, with finished neckline, seams, hems and natural fabric fall',
    dupatta:
      'a full-length dupatta made from this exact listed textile, draped naturally over the existing outfit with realistic folds and gravity',
    top:
      'a finished upper-body garment made from this exact listed textile, matching the product listing and preserving realistic tailoring',
    bottom:
      'a finished lower-body garment made from this exact listed textile, matching the product listing and preserving realistic tailoring',
    set:
      'a coordinated top-and-bottom garment set made from this exact listed textile, matching the product listing and preserving realistic tailoring',
    fabric:
      'a neutral wearable fabric drape using this exact listed textile. Do not invent a specific garment type that the seller did not list; present the textile as a realistic wrapped drape on the body',
  };
  return prompts[style];
}

export function drapeProductStyleApiId(style: DrapeProductStyle) {
  if (style === 'saree' || style === 'lehenga' || style === 'kurta' || style === 'shirt' || style === 'dress' || style === 'dupatta') {
    return style;
  }
  return 'product-derived';
}
