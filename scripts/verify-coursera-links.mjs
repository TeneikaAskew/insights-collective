// ABOUTME: Checks every slug in src/data/courseraCatalog.ts still resolves on
// ABOUTME: coursera.org. The catalog is hand-curated because Coursera has no free
// ABOUTME: public catalog API, so slugs can silently rot when a course is retired
// ABOUTME: or moved between /learn/ and /specializations/. Run: npm run verify:coursera

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(here, '../src/data/courseraCatalog.ts');

/**
 * Parse the catalog without importing it — this is a plain Node script and the
 * catalog is TypeScript. We only need slug + format to build a URL.
 */
async function readCatalog() {
  const source = await readFile(CATALOG_PATH, 'utf8');
  const entries = [];

  const blocks = source.split(/\n  \{\n/).slice(1);
  for (const block of blocks) {
    const slug = /slug: '([^']+)'/.exec(block)?.[1];
    const title = /title: '([^']+)'|title: "([^"]+)"/.exec(block);
    const format = /format: '([^']+)'/.exec(block)?.[1];
    if (slug && format) {
      entries.push({ slug, format, title: title?.[1] ?? title?.[2] ?? slug });
    }
  }
  return entries;
}

function urlFor({ slug, format }) {
  return `https://www.coursera.org/${format === 'Course' ? 'learn' : 'specializations'}/${slug}`;
}

async function check(entry) {
  const url = urlFor(entry);
  try {
    // Coursera 404s are served as real 404 status codes. Follow redirects: a
    // course moving to a new slug is fine as long as it still lands somewhere.
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; insights-collective-link-check)' },
    });
    return { ...entry, url, status: response.status, finalUrl: response.url, ok: response.ok };
  } catch (error) {
    return { ...entry, url, status: 0, ok: false, error: error.message };
  }
}

const catalog = await readCatalog();
if (catalog.length === 0) {
  console.error('Parsed 0 entries from the catalog — the file format probably changed.');
  process.exit(1);
}

console.log(`Checking ${catalog.length} Coursera links…\n`);

const results = [];
for (const entry of catalog) {
  const result = await check(entry);
  results.push(result);
  const mark = result.ok ? '  ok ' : ' FAIL';
  console.log(`${mark} ${String(result.status).padEnd(3)} ${result.url}`);
  if (result.ok && result.finalUrl && !result.finalUrl.startsWith(result.url)) {
    console.log(`       ↳ redirected to ${result.finalUrl}`);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} reachable.`);

if (failed.length > 0) {
  console.log('\nFix or remove these entries in src/data/courseraCatalog.ts:');
  for (const entry of failed) {
    console.log(`  - ${entry.slug} (${entry.title})${entry.error ? ` — ${entry.error}` : ''}`);
  }
  process.exit(1);
}
