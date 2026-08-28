import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const lastModified = new Date();

  // FabricTrad is a private marketplace: catalogue, vendor, product, cart and
  // account routes require an active login and must not be advertised to crawlers.
  return [
    { url: baseUrl, lastModified, priority: 1.0 },
    { url: `${baseUrl}/register`, lastModified, priority: 0.8 },
    { url: `${baseUrl}/buyer-registration`, lastModified, priority: 0.8 },
    { url: `${baseUrl}/seller-registration`, lastModified, priority: 0.75 },
    { url: `${baseUrl}/how-to-use`, lastModified, priority: 0.7 },
    { url: `${baseUrl}/help`, lastModified, priority: 0.65 },
    { url: `${baseUrl}/privacy`, lastModified, priority: 0.4 },
    { url: `${baseUrl}/terms`, lastModified, priority: 0.4 },
  ];
}
