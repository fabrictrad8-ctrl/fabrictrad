import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FabricTrad',
    short_name: 'FabricTrad',
    description: 'Mobile-first textile sourcing, seller operations, orders and catalogue management.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#111827',
    theme_color: '#f97316',
    categories: ['business', 'shopping', 'productivity'],
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
