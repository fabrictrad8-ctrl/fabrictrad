export type CatalogProduct = {
  id: string;
  source: 'catalog' | 'seller';
  sellerId?: string | null;
  name: string;
  seller: string;
  city: string;
  category: string;
  price: number;
  unit: string;
  moq: number;
  available: number;
  gsm: number;
  width: string;
  work: string;
  rating: number;
  reviews: number;
  badge: 'bestseller' | 'new' | 'premium' | null;
  verified: boolean;
  image: string;
  images: string[];
  alt: string;
  dispatchDays: number;
  gst: boolean;
  description?: string;
  sku?: string | null;
};

const makeImages = (image: string, extras: string[] = []) => [image, ...extras].filter(Boolean);

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  { id: 'mp1', source: 'catalog', name: 'Pure Dyeable Soft Nett Fabric', seller: 'Surat Textile Mills Pvt Ltd', city: 'Surat, Gujarat', category: 'Net & Netting', price: 840, unit: 'mtr', moq: 50, available: 2400, gsm: 120, width: '44 inches', work: 'Handwork', rating: 4.8, reviews: 124, badge: 'bestseller', verified: true, image: 'https://images.unsplash.com/photo-1727933882951-115ddb44388d', images: makeImages('https://images.unsplash.com/photo-1727933882951-115ddb44388d', ['https://img.rocket.new/generatedImages/rocket_gen_img_1acbbfc48-1773129576236.png','https://img.rocket.new/generatedImages/rocket_gen_img_13cdc9d4f-1772216883669.png','https://img.rocket.new/generatedImages/rocket_gen_img_1b23ddc65-1772723055087.png']), alt: 'Cream nett fabric with gold embroidery floral pattern close-up', dispatchDays: 3, gst: true, description: 'Soft dyeable nett fabric for occasionwear, lehengas and overlays.' },
  { id: 'mp2', source: 'catalog', name: 'Premium Cotton Cambric', seller: 'Bhiwandi Weave House', city: 'Bhiwandi, Maharashtra', category: 'Cotton', price: 185, unit: 'mtr', moq: 100, available: 5400, gsm: 80, width: '60 inches', work: 'Plain', rating: 4.6, reviews: 89, badge: 'new', verified: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_197569977-1767988369489.png', images: makeImages('https://img.rocket.new/generatedImages/rocket_gen_img_197569977-1767988369489.png'), alt: 'Rolled white cotton fabric bolts in bright warehouse', dispatchDays: 2, gst: true },
  { id: 'mp3', source: 'catalog', name: 'Georgette Embroidered', seller: 'Jaipur Crafts Emporium', city: 'Jaipur, Rajasthan', category: 'Georgette', price: 1250, unit: 'mtr', moq: 25, available: 800, gsm: 90, width: '44 inches', work: 'Zari Work', rating: 4.9, reviews: 67, badge: 'bestseller', verified: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1a15cecc6-1766283014372.png', images: makeImages('https://img.rocket.new/generatedImages/rocket_gen_img_1a15cecc6-1766283014372.png'), alt: 'Pink georgette with gold zari embroidery on mannequin', dispatchDays: 5, gst: true },
  { id: 'mp4', source: 'catalog', name: 'Banarasi Silk Brocade', seller: 'Varanasi Silk Traders', city: 'Varanasi, Uttar Pradesh', category: 'Silk', price: 3200, unit: 'mtr', moq: 10, available: 350, gsm: 200, width: '44 inches', work: 'Zari Work', rating: 5, reviews: 43, badge: 'premium', verified: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_13e79a640-1775554509083.png', images: makeImages('https://img.rocket.new/generatedImages/rocket_gen_img_13e79a640-1775554509083.png'), alt: 'Deep red Banarasi silk with intricate gold brocade pattern', dispatchDays: 7, gst: true },
  { id: 'mp5', source: 'catalog', name: 'Polyester Crepe Fabric', seller: 'Mumbai Fabric Zone', city: 'Mumbai, Maharashtra', category: 'Polyester', price: 320, unit: 'mtr', moq: 200, available: 6200, gsm: 140, width: '58 inches', work: 'Plain', rating: 4.4, reviews: 201, badge: null, verified: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1dfa765bb-1772211451367.png', images: makeImages('https://img.rocket.new/generatedImages/rocket_gen_img_1dfa765bb-1772211451367.png'), alt: 'Colorful polyester fabric rolls stacked in bright warehouse', dispatchDays: 2, gst: false },
  { id: 'mp6', source: 'catalog', name: 'Handloom Khadi Cotton', seller: 'Kutch Khadi Gramodyog', city: 'Bhuj, Gujarat', category: 'Handloom', price: 450, unit: 'mtr', moq: 50, available: 1200, gsm: 160, width: '36 inches', work: 'Handloom', rating: 4.7, reviews: 56, badge: 'new', verified: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_11953b441-1772872649342.png', images: makeImages('https://img.rocket.new/generatedImages/rocket_gen_img_11953b441-1772872649342.png'), alt: 'Natural khadi cotton on traditional wooden loom, artisan weaving', dispatchDays: 6, gst: true },
  { id: 'mp7', source: 'catalog', name: 'Velvet Crush Fabric', seller: 'Ludhiana Velvet House', city: 'Ludhiana, Punjab', category: 'Velvet', price: 680, unit: 'mtr', moq: 30, available: 20, gsm: 280, width: '44 inches', work: 'Plain', rating: 4.5, reviews: 38, badge: null, verified: false, image: 'https://images.unsplash.com/photo-1556354148-58e886e0c4ec', images: makeImages('https://images.unsplash.com/photo-1556354148-58e886e0c4ec'), alt: 'Deep purple crushed velvet fabric with rich light-reflecting texture', dispatchDays: 4, gst: true },
  { id: 'mp8', source: 'catalog', name: 'Organza Sequence Fabric', seller: 'Surat Zari Works', city: 'Surat, Gujarat', category: 'Organza', price: 980, unit: 'mtr', moq: 20, available: 45, gsm: 60, width: '44 inches', work: 'Sequence', rating: 4.8, reviews: 91, badge: 'bestseller', verified: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1807e8cd1-1771579098647.png', images: makeImages('https://img.rocket.new/generatedImages/rocket_gen_img_1807e8cd1-1771579098647.png'), alt: 'Sheer white organza with gold sequence embroidery on dark background', dispatchDays: 4, gst: true },
  { id: 'mp9', source: 'catalog', name: 'Linen Slub Fabric', seller: 'Kolkata Linen Co.', city: 'Kolkata, West Bengal', category: 'Linen', price: 560, unit: 'mtr', moq: 75, available: 1200, gsm: 180, width: '58 inches', work: 'Plain', rating: 4.3, reviews: 29, badge: null, verified: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_186b88c42-1772146413683.png', images: makeImages('https://img.rocket.new/generatedImages/rocket_gen_img_186b88c42-1772146413683.png'), alt: 'Natural linen slub fabric with visible texture weave in warm beige tones', dispatchDays: 5, gst: true },
  { id: 'mp10', source: 'catalog', name: 'Chiffon Digital Print', seller: 'Ahmedabad Print House', city: 'Ahmedabad, Gujarat', category: 'Georgette', price: 420, unit: 'mtr', moq: 50, available: 30, gsm: 70, width: '44 inches', work: 'Digital Print', rating: 4.6, reviews: 112, badge: 'new', verified: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_12cbc1d6c-1780173991466.png', images: makeImages('https://img.rocket.new/generatedImages/rocket_gen_img_12cbc1d6c-1780173991466.png'), alt: 'Flowing chiffon fabric with vibrant digital floral print', dispatchDays: 3, gst: true },
  { id: 'mp11', source: 'catalog', name: 'Wool Blend Suiting', seller: 'Ludhiana Suiting Mills', city: 'Ludhiana, Punjab', category: 'Wool', price: 1800, unit: 'mtr', moq: 20, available: 700, gsm: 320, width: '58 inches', work: 'Plain', rating: 4.7, reviews: 44, badge: null, verified: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_138ab1587-1781344617013.png', images: makeImages('https://img.rocket.new/generatedImages/rocket_gen_img_138ab1587-1781344617013.png'), alt: 'Charcoal grey wool suiting fabric with fine stripe weave', dispatchDays: 7, gst: true },
  { id: 'mp12', source: 'catalog', name: 'Denim Stretch Fabric', seller: 'Ahmedabad Denim Works', city: 'Ahmedabad, Gujarat', category: 'Denim', price: 380, unit: 'mtr', moq: 150, available: 3800, gsm: 260, width: '60 inches', work: 'Plain', rating: 4.5, reviews: 78, badge: null, verified: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_19faec2de-1775604046124.png', images: makeImages('https://img.rocket.new/generatedImages/rocket_gen_img_19faec2de-1775604046124.png'), alt: 'Indigo blue stretch denim fabric rolls in factory setting', dispatchDays: 4, gst: false },
];

export function getCatalogProduct(id?: string | null) {
  return CATALOG_PRODUCTS.find((product) => product.id === id) || CATALOG_PRODUCTS[0];
}

export function productDetailHref(product: Pick<CatalogProduct, 'id' | 'source'>) {
  return `/product-detail?id=${encodeURIComponent(product.id)}`;
}
