'use client';

type AccountProfile = {
  id?: string;
  role?: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
  business_name?: string;
  city?: string;
  state?: string;
  gstin?: string;
} | null;

type AccountUser = {
  id?: string;
  email?: string;
} | null;

export type RecommendationProduct = {
  id: string;
  name: string;
  seller?: string;
  sellerCity?: string;
  city?: string;
  price: number;
  moq: number;
  rating: number;
  reviews: number;
  badge?: string | null;
  verified?: boolean;
  gstReady?: boolean;
  gst?: boolean;
  dispatch?: string;
  work?: string;
  gsm?: string;
};

const categories = [
  'cotton',
  'cambric',
  'silk',
  'brocade',
  'georgette',
  'organza',
  'net',
  'nett',
  'linen',
  'khadi',
  'velvet',
  'crepe',
  'chiffon',
  'denim',
  'wool',
  'embroidery',
  'embroidered',
  'zari',
  'print',
];

const hashText = (value: string) =>
  value.split('').reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 9973, 7);

const productText = (product: RecommendationProduct) =>
  [
    product.name,
    product.seller,
    product.sellerCity,
    product.city,
    product.work,
    product.gsm,
    product.badge,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const accountText = (profile: AccountProfile, user: AccountUser) =>
  [
    profile?.full_name,
    profile?.email,
    profile?.business_name,
    profile?.city,
    profile?.state,
    profile?.gstin,
    user?.email,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const dispatchScore = (dispatch?: string) => {
  const days = Number(dispatch?.match(/\d+/)?.[0] || 7);
  return Math.max(0, 8 - days);
};

export function personalizeProducts<T extends RecommendationProduct>(
  products: T[],
  profile: AccountProfile,
  user: AccountUser,
  intent: 'homepage' | 'marketplace' = 'homepage'
) {
  const role = profile?.role || 'guest';
  const signals = accountText(profile, user);
  const accountSeed = hashText(`${profile?.id || user?.id || 'guest'}:${role}`);

  return [...products].sort((a, b) => {
    const score = (product: T) => {
      const text = productText(product);
      let value = product.rating * 16 + product.reviews * 0.12 + dispatchScore(product.dispatch);

      if (product.verified) value += 8;
      if (product.gstReady || product.gst) value += 5;
      if (product.badge === 'bestseller') value += 9;
      if (product.badge === 'new') value += role === 'buyer' ? 7 : 3;
      if (product.badge === 'premium')
        value += role === 'admin_staff' || role === 'super_admin' ? 8 : 2;

      for (const category of categories) {
        if (signals.includes(category) && text.includes(category)) value += 18;
      }

      if (profile?.city && text.includes(profile.city.toLowerCase())) value += 10;
      if (profile?.state && text.includes(profile.state.toLowerCase())) value += 8;

      if (role === 'seller') {
        value += product.moq >= 50 ? 8 : 0;
        value += product.reviews > 75 ? 6 : 0;
      } else if (role === 'buyer') {
        value += product.moq <= 50 ? 8 : 0;
        value += product.price <= 1000 ? 5 : 0;
      } else if (role === 'admin_staff' || role === 'super_admin') {
        value += product.reviews * 0.18;
        value += product.verified ? 8 : -6;
      }

      if (intent === 'marketplace') value += product.name.length % 5;

      return value + (hashText(`${accountSeed}:${product.id}`) % 17) / 10;
    };

    return score(b) - score(a);
  });
}
