import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return [
    { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    { url: `${baseUrl}/marketplace`, lastModified: new Date(), priority: 0.9 },
    { url: `${baseUrl}/product-detail`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/buyer-registration`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/buyer-dashboard`, lastModified: new Date(), priority: 0.5 },
    { url: `${baseUrl}/seller-dashboard`, lastModified: new Date(), priority: 0.5 },
    { url: `${baseUrl}/admin-portal`, lastModified: new Date(), priority: 0.3 },
  ];
}
