import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
          '/admin-portal/',
          '/buyer-dashboard/',
          '/seller-dashboard/',
          '/marketplace',
          '/categories',
          '/vendors',
          '/product-detail',
          '/cart',
          '/account',
          '/profile',
          '/buyer-requirements',
          '/company-purchasing',
          '/returns-exchanges',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
