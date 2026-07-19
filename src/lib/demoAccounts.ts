export type DemoRole = 'buyer' | 'seller';

export type DemoAccount = {
  role: DemoRole;
  email: string;
  password: string;
  fullName: string;
  phone: string;
  company: string;
  description: string;
};

export const DEMO_ACCOUNTS: Record<DemoRole, DemoAccount> = {
  buyer: {
    role: 'buyer',
    email: 'demo.buyer@fabrictrad.com',
    password: 'FabricDemo@2026',
    fullName: 'Demo Buyer',
    phone: '9000000101',
    company: 'Demo Buyer Textiles',
    description: 'Explore sourcing, requirements, orders, tracking, chat, and profile tools.',
  },
  seller: {
    role: 'seller',
    email: 'demo.seller@fabrictrad.com',
    password: 'FabricDemo@2026',
    fullName: 'Demo Seller',
    phone: '9000000202',
    company: 'Demo Seller Fabrics',
    description: 'Explore catalog upload, inventory, orders, delivery, payouts, and inbox tools.',
  },
};

export const DEMO_SESSION_STORAGE_KEY = 'fabrictrad_demo_session_v1';

export function getDemoAccountByEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase();
  return Object.values(DEMO_ACCOUNTS).find((account) => account.email === normalized) || null;
}

export function isDemoAccountEmail(email?: string | null) {
  return !!getDemoAccountByEmail(email);
}

export function validateDemoCredentials(email: string, password: string) {
  const account = getDemoAccountByEmail(email);
  if (!account || account.password !== password) return null;
  return account;
}

export function getDemoUserId(role: DemoRole) {
  return `fabrictrad-demo-${role}`;
}

export const DEMO_BULK_ORDERS = {
  buyer: [
    {
      id: 'demo-buyer-order-001',
      status: 'shipped',
      buyer_name: 'Demo Buyer',
      buyer_company: 'Demo Buyer Textiles',
      buyer_email: DEMO_ACCOUNTS.buyer.email,
      seller_id: 'demo-seller-profile',
      gross_total: 167400,
      gst_total: 8370,
      net_total: 175770,
      created_at: '2026-07-18T10:30:00.000Z',
      bulk_order_items: [
        {
          product_name: 'Pure Dyeable Soft Nett Fabric',
          quantity_mtrs: 180,
          price_per_mtr: 930,
        },
      ],
    },
    {
      id: 'demo-buyer-order-002',
      status: 'quote_sent',
      buyer_name: 'Demo Buyer',
      buyer_company: 'Demo Buyer Textiles',
      buyer_email: DEMO_ACCOUNTS.buyer.email,
      seller_id: 'demo-seller-profile',
      gross_total: 84000,
      gst_total: 4200,
      net_total: 88200,
      created_at: '2026-07-17T08:15:00.000Z',
      bulk_order_items: [
        {
          product_name: 'Digital Printed Chiffon',
          quantity_mtrs: 200,
          price_per_mtr: 420,
        },
      ],
    },
  ],
  seller: [
    {
      id: 'demo-seller-order-001',
      status: 'quote_sent',
      buyer_name: 'Priya Mehta',
      buyer_company: 'Surat Boutique Studio',
      buyer_email: 'buyer@example.com',
      seller_id: 'demo-seller-profile',
      gross_total: 126000,
      gst_total: 6300,
      net_total: 132300,
      created_at: '2026-07-19T06:45:00.000Z',
      bulk_order_items: [
        {
          product_name: 'Georgette Embroidered',
          quantity_mtrs: 100,
          price_per_mtr: 1260,
        },
      ],
    },
    {
      id: 'demo-seller-order-002',
      status: 'paid',
      buyer_name: 'Aman Shah',
      buyer_company: 'Jaipur Garment House',
      buyer_email: 'procurement@example.com',
      seller_id: 'demo-seller-profile',
      gross_total: 214000,
      gst_total: 10700,
      net_total: 224700,
      created_at: '2026-07-18T11:10:00.000Z',
      bulk_order_items: [
        {
          product_name: 'Linen Slub Fabric',
          quantity_mtrs: 400,
          price_per_mtr: 535,
        },
      ],
    },
    {
      id: 'demo-seller-order-003',
      status: 'shipped',
      buyer_name: 'Neha Kapoor',
      buyer_company: 'Mumbai Design Co.',
      buyer_email: 'orders@example.com',
      seller_id: 'demo-seller-profile',
      gross_total: 98000,
      gst_total: 4900,
      net_total: 102900,
      created_at: '2026-07-16T13:20:00.000Z',
      bulk_order_items: [
        {
          product_name: 'Organza Sequence Fabric',
          quantity_mtrs: 100,
          price_per_mtr: 980,
        },
      ],
    },
  ],
};

export const DEMO_SHIPMENTS = [
  {
    orderId: 'FT-BULK-DEMO001',
    shipmentId: 'FT-SHP-DEMO-OWN-001',
    awb: 'DTDC-DEMO-77821',
    courier: 'DTDC Express (seller managed)',
    product: 'Pure Dyeable Soft Nett Fabric',
    seller: 'Demo Seller Fabrics',
    status: 'in_transit',
    statusLabel: 'In Transit',
    edd: '22 Jul 2026',
    lastUpdate: 'Ahmedabad Hub · live tracking URL maintained by seller',
    trackingUrl: 'https://www.dtdc.in/tracking.asp',
    timeline: [
      { event: 'Order confirmed', time: '18 Jul, 10:30 AM', done: true },
      { event: 'Packed by seller', time: '18 Jul, 04:20 PM', done: true },
      { event: 'Picked up by DTDC', time: '19 Jul, 09:15 AM', done: true },
      { event: 'In transit', time: '19 Jul, 02:40 PM', done: true, active: true },
      { event: 'Out for delivery', time: 'Expected 22 Jul', done: false },
    ],
  },
];
