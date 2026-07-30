import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const lastModified = new Date();

  return [
    { url: baseUrl, lastModified, priority: 1.0 },
    { url: `${baseUrl}/marketplace`, lastModified, priority: 0.95 },
    { url: `${baseUrl}/categories`, lastModified, priority: 0.9 },
    { url: `${baseUrl}/vendors`, lastModified, priority: 0.9 },
    { url: `${baseUrl}/product-detail`, lastModified, priority: 0.85 },
    { url: `${baseUrl}/register`, lastModified, priority: 0.8 },
    { url: `${baseUrl}/buyer-registration`, lastModified, priority: 0.8 },
    { url: `${baseUrl}/seller-registration`, lastModified, priority: 0.8 },
    { url: `${baseUrl}/login`, lastModified, priority: 0.7 },
    { url: `${baseUrl}/help`, lastModified, priority: 0.65 },
    { url: `${baseUrl}/privacy`, lastModified, priority: 0.4 },
    { url: `${baseUrl}/terms`, lastModified, priority: 0.4 },
  ];
}
