import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/dashboard', '/test', '/profil', '/mekan'],
      },
    ],
    sitemap: 'https://ahenk.co/sitemap.xml',
  };
}
