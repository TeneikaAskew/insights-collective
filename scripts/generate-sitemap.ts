// ABOUTME: Generates public/sitemap.xml before dev and build (predev/prebuild hooks).
// ABOUTME: Lists the public, indexable routes of the app — no auth, admin or per-user surfaces.

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'https://insightscollective.org';

interface SitemapEntry {
  path: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
}

// Public routes only: everything reachable without a session and safe to index.
// Auth flows, /admin, /dashboard, per-user and builder routes are deliberately omitted.
const entries: SitemapEntry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/courses', changefreq: 'weekly', priority: '0.9' },
  { path: '/explore-data-careers', changefreq: 'monthly', priority: '0.8' },
  { path: '/career-pathway', changefreq: 'monthly', priority: '0.8' },
  { path: '/interview-prep', changefreq: 'monthly', priority: '0.7' },
  { path: '/interview-prep/code-practice', changefreq: 'monthly', priority: '0.6' },
  { path: '/interview-prep/mock-interviews', changefreq: 'monthly', priority: '0.6' },
  { path: '/interview-prep/star-practice', changefreq: 'monthly', priority: '0.6' },
  { path: '/assistants', changefreq: 'monthly', priority: '0.6' },
  { path: '/resume', changefreq: 'monthly', priority: '0.6' },
  { path: '/resources', changefreq: 'weekly', priority: '0.7' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
  { path: '/events', changefreq: 'weekly', priority: '0.7' },
  { path: '/portfolio-explorer', changefreq: 'weekly', priority: '0.6' },
  { path: '/survey', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms-of-service', changefreq: 'yearly', priority: '0.3' },
];

function generateSitemap(items: SitemapEntry[]) {
  const urls = items.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join('\n');
}

writeFileSync(resolve('public/sitemap.xml'), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);
