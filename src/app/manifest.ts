import type { MetadataRoute } from 'next';

const BRAND_ICON_192 = '/assets/brand/fabrictrad-app-icon-192.png';
const BRAND_ICON_512 = '/assets/brand/fabrictrad-app-icon-512.png';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FabricTrad',
    short_name: 'FabricTrad',
    description: 'Mobile-first textile sourcing, seller operations, orders and catalogue management.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#e8a817',
    categories: ['business', 'shopping', 'productivity'],
    icons: [
      {
        src: BRAND_ICON_192,
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: BRAND_ICON_512,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
