// ABOUTME: Fetches live course data from Coursera and writes a CSV that
// ABOUTME: build-coursera-catalog.mjs consumes, so the catalog no longer depends on
// ABOUTME: a downloaded dataset snapshot. Reads the public course pages and parses
// ABOUTME: the state blob they embed — it never touches /api/ or /search, which
// ABOUTME: Coursera's robots.txt disallows. Usage:
// ABOUTME:   npm run fetch:coursera -- --refresh
// ABOUTME:   npm run fetch:coursera -- --discover --limit 400

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(here, '../src/data/courseraCatalog.generated.ts');
const KEYWORDS_PATH = resolve(here, '../src/data/subjectKeywords.json');
const DENYLIST_PATH = resolve(here, './coursera-denylist.json');
const CACHE_DIR = resolve(here, '../.cache/coursera');

/**
 * Paths robots.txt permits. `/api/` and `/search` are explicitly disallowed, so
 * discovery goes through the advertised sitemaps and everything else through the
 * ordinary public course pages a browser would load.
 */
const ALLOWED_PATHS = ['learn', 'specializations', 'professional-certificates'];

const SITEMAPS = [
  'https://www.coursera.org/sitemap~www~courses.xml',
  'https://www.coursera.org/sitemap~www~specializations.xml',
  'https://www.coursera.org/sitemap~www~certificates.xml',
];

/** Identify the tool honestly so Coursera can see who is asking and rate-limit us. */
const USER_AGENT =
  'insights-collective-catalog/1.0 (course directory refresh; contact: repo owner)';

/** Conservative: 4 in flight with a pause between batches, not a flood. */
const CONCURRENCY = 4;
const DELAY_MS = 350;
const MAX_RETRIES = 3;
/** Skip re-fetching a page cached more recently than this. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// HTTP with caching, retries and backoff
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function cachePathFor(url) {
  return join(CACHE_DIR, `${createHash('sha1').update(url).digest('hex')}.html`);
}

async function fetchWithRetry(url, { useCache = true } = {}) {
  const cacheFile = cachePathFor(url);

  if (useCache && existsSync(cacheFile)) {
    const { mtimeMs } = await import('node:fs').then((fs) => fs.promises.stat(cacheFile));
    if (Date.now() - mtimeMs < CACHE_TTL_MS) {
      return { html: await readFile(cacheFile, 'utf8'), fromCache: true };
    }
  }

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      });

      if (response.status === 404) return { html: null, status: 404 };

      // Back off hard on rate limiting rather than hammering through it.
      if (response.status === 429 || response.status >= 500) {
        const wait = 2000 * 2 ** attempt;
        lastError = new Error(`HTTP ${response.status}`);
        await sleep(wait);
        continue;
      }

      if (!response.ok) return { html: null, status: response.status };

      const html = await response.text();
      if (useCache) {
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(cacheFile, html, 'utf8');
      }
      return { html, status: response.status };
    } catch (error) {
      lastError = error;
      await sleep(1000 * 2 ** attempt);
    }
  }
  return { html: null, error: lastError?.message ?? 'unknown' };
}

/** Runs `worker` over `items` with a fixed concurrency cap and a pause per batch. */
async function mapLimited(items, worker, onProgress) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(worker))));
    if (onProgress) onProgress(Math.min(i + CONCURRENCY, items.length), items.length);
    if (i + CONCURRENCY < items.length) await sleep(DELAY_MS);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Page parsing
// ---------------------------------------------------------------------------

/**
 * Pull the Apollo cache out of a course page.
 *
 * Brace-matched rather than regex-captured: the blob is ~150KB of nested JSON
 * containing braces inside strings, which a lazy regex truncates at the wrong
 * place. This walks the text tracking string and escape state.
 */
function extractApolloState(html) {
  const marker = 'window.__APOLLO_STATE__';
  const markerAt = html.indexOf(marker);
  if (markerAt === -1) return null;

  const start = html.indexOf('{', markerAt);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const char = html[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function nodesOfType(state, typename) {
  return Object.values(state).filter(
    (node) => node && typeof node === 'object' && node.__typename === typename,
  );
}

/** Resolve Apollo's `{__ref: "Type:id"}` indirection. */
function deref(state, value) {
  if (Array.isArray(value)) return value.map((item) => deref(state, item));
  if (value && typeof value === 'object' && typeof value.__ref === 'string') {
    return state[value.__ref] ?? null;
  }
  return value;
}

/** "PT7H4M54S" / "PT2M44S" -> hours as a decimal. */
function isoDurationToHours(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value ?? ''));
  if (!match) return null;
  const [, h = 0, m = 0, s = 0] = match;
  const hours = Number(h) + Number(m) / 60 + Number(s) / 3600;
  return hours > 0 ? Math.round(hours * 10) / 10 : null;
}

/**
 * Normalize one course page into the shape the catalog generator reads.
 *
 * Course pages and specialization/certificate pages use different Apollo
 * typenames for the same concepts, so each field falls back across both.
 */
function parseCoursePage(html, url) {
  const state = extractApolloState(html);
  if (!state) return { error: 'no state blob' };

  const page =
    nodesOfType(state, 'DescriptionPage_CoursePage')[0] ??
    nodesOfType(state, 'DescriptionPage_SpecializationPage')[0] ??
    nodesOfType(state, 'DescriptionPage_Specialization')[0];
  if (!page) return { error: 'no course node' };

  const title = String(page.name ?? '').trim();
  if (!title) return { error: 'no title' };

  const partners = (deref(state, page.partners) ?? [])
    .map((partner) => partner?.name)
    .filter(Boolean);
  // Partner nodes are shared across the page (a specialization lists its member
  // courses' partners too), so fall back to any partner node present.
  const partner =
    partners[0] ?? nodesOfType(state, 'DescriptionPage_Partner')[0]?.name ?? 'Coursera';

  const skills = [
    ...new Set(
      (deref(state, page.skillTags) ?? nodesOfType(state, 'DescriptionPage_SkillTag'))
        .map((tag) => String(tag?.name ?? '').trim())
        .filter(Boolean),
    ),
  ];

  const ratings = deref(state, page.ratings) ?? {};
  const rating = ratings.averageFiveStarRating ?? page.averageFiveStarRating ?? null;
  const reviews = ratings.ratingCount ?? page.ratingCount ?? null;

  const material = deref(state, page.material);
  const weeks = material ? (deref(state, material.weeks ?? material) ?? []) : [];
  const totalHours = Array.isArray(weeks)
    ? weeks.reduce((sum, week) => sum + (isoDurationToHours(week?.totalDuration) ?? 0), 0)
    : null;

  const reviewComments = nodesOfType(state, 'DescriptionPage_Review')
    .map((review) => ({
      rating: review.rating ?? null,
      comment: String(review.comment ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
    }))
    .filter((review) => review.comment)
    .slice(0, 5);

  return {
    url,
    title,
    partner,
    skills,
    description: String(page.description ?? '').replace(/\s+/g, ' ').trim(),
    level: page.difficultyLevel ?? null,
    rating: rating === null ? null : Math.round(Number(rating) * 100) / 100,
    reviews: reviews === null ? null : Number(reviews),
    enrolled: page.totalEnrollmentCount ? Number(page.totalEnrollmentCount) : null,
    estimatedHours: totalHours && totalHours > 0 ? Math.round(totalHours * 10) / 10 : null,
    reviewComments,
  };
}

// ---------------------------------------------------------------------------
// URL sources
// ---------------------------------------------------------------------------

/** Slugs already in the generated catalog — the refresh set. */
async function urlsFromCatalog() {
  if (!existsSync(CATALOG_PATH)) return [];
  const source = await readFile(CATALOG_PATH, 'utf8');
  return [...source.matchAll(/url: "([^"]+)"/g)].map((match) => match[1]);
}

/**
 * Candidate URLs from the sitemaps, filtered by subject keywords in the slug.
 *
 * The sitemaps list 21,000+ courses. Fetching all of them would be both slow and
 * rude, and most are irrelevant to data and AI careers, so the slug is matched
 * against the same keyword table the catalog uses. Slugs are descriptive enough
 * ("sql-for-data-science", "machine-learning") for this to work well.
 */
async function urlsFromSitemaps(limit) {
  const raw = JSON.parse(await readFile(KEYWORDS_PATH, 'utf8'));
  const keywords = Object.entries(raw)
    .filter(([subject]) => !subject.startsWith('$'))
    .flatMap(([, list]) => list)
    // Slugs are hyphen-separated, so multi-word keywords have to be too.
    .map((keyword) => keyword.replace(/[^a-z0-9]+/g, '-'))
    .filter((keyword) => keyword.length >= 3);
  const patterns = [...new Set(keywords)].map(
    (keyword) => new RegExp(`(^|-)${keyword}(-|$)`, 'i'),
  );

  const candidates = new Set();
  for (const sitemap of SITEMAPS) {
    const { html } = await fetchWithRetry(sitemap);
    if (!html) {
      console.warn(`  could not read ${sitemap}`);
      continue;
    }
    const locs = [...html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    let matched = 0;
    for (const loc of locs) {
      const parsed = /coursera\.org\/(learn|specializations|professional-certificates)\/([^/?#]+)$/.exec(loc);
      if (!parsed) continue;
      // Skip translated variants: -zhtw, -ptbr, -es, -fr and friends duplicate the
      // English course under a localized slug.
      if (/-(zhtw|zhcn|ptbr|es|fr|de|ja|ko|ru|ar|tr|id|vi|th|hi|pt|it|pl)$/.test(parsed[2])) {
        continue;
      }
      if (patterns.some((pattern) => pattern.test(parsed[2]))) {
        candidates.add(`https://www.coursera.org/${parsed[1]}/${parsed[2]}`);
        matched += 1;
      }
    }
    console.log(`  ${sitemap.split('~').pop()}: ${locs.length} urls, ${matched} on-topic`);
  }

  const all = [...candidates].sort();
  if (all.length <= limit) return all;

  // Stride-sample rather than slice. The list is sorted by slug, so taking the
  // first N would fetch nothing but courses starting with "a". A fixed stride
  // spreads the sample across the whole catalog and stays deterministic, so the
  // on-disk cache still hits when the limit is raised later.
  const stride = all.length / limit;
  const sampled = [];
  for (let i = 0; sampled.length < limit && Math.floor(i * stride) < all.length; i += 1) {
    sampled.push(all[Math.floor(i * stride)]);
  }

  console.log(
    `  ${all.length} candidates, sampling ${sampled.length} across the catalog ` +
      `(raise with --limit)`,
  );
  return sampled;
}

// ---------------------------------------------------------------------------
// CSV output
// ---------------------------------------------------------------------------

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Writes the column names build-coursera-catalog.mjs expects, so the two scripts
 * compose without either knowing about the other's internals. `estimated_hours`
 * and `top_reviews` are extra; the generator ignores what it does not read.
 */
function toCsv(courses) {
  const header = [
    'title',
    'Organization',
    'Skills',
    'Description',
    'Level',
    'URL',
    'rating',
    'num_reviews',
    'enrolled',
    'estimated_hours',
    'top_reviews',
  ];

  const rows = courses.map((course) =>
    [
      course.title,
      course.partner,
      // Match the stringified-list shape the generator's parseSkills() reads.
      `[${course.skills.map((skill) => `'${skill.replace(/'/g, "\\'")}'`).join(', ')}]`,
      course.description,
      course.level ? `${course.level[0]}${course.level.slice(1).toLowerCase()} level` : '',
      course.url,
      course.rating ?? '',
      course.reviews ?? '',
      course.enrolled ?? '',
      course.estimatedHours ?? '',
      JSON.stringify(course.reviewComments ?? []),
    ]
      .map(csvCell)
      .join(','),
  );

  return `${[header.join(','), ...rows].join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const mode = args.includes('--discover') ? 'discover' : 'refresh';
const noCache = args.includes('--no-cache');
const limitArg = args.indexOf('--limit');
const limit = limitArg === -1 ? 400 : Number(args[limitArg + 1]);
const outArg = args.indexOf('--out');
const outPath = resolve(
  process.cwd(),
  outArg === -1 ? 'coursera-live.csv' : args[outArg + 1],
);

const denylist = new Set(
  JSON.parse(await readFile(DENYLIST_PATH, 'utf8')).denied.map((entry) => entry.slug),
);

console.log(`Mode: ${mode}${noCache ? ' (cache bypassed)' : ''}`);

let urls =
  mode === 'discover'
    ? await urlsFromSitemaps(limit)
    : await urlsFromCatalog();

urls = urls.filter((url) => {
  const parsed = /coursera\.org\/([a-z-]+)\/([^/?#]+)/.exec(url);
  if (!parsed || !ALLOWED_PATHS.includes(parsed[1])) return false;
  return !denylist.has(parsed[2]);
});

if (urls.length === 0) {
  console.error(
    mode === 'refresh'
      ? 'Nothing to refresh — no generated catalog yet. Run with --discover first.'
      : 'No candidate URLs found.',
  );
  process.exit(1);
}

console.log(`Fetching ${urls.length} course pages…`);

const courses = [];
const failures = [];

await mapLimited(
  urls,
  async (url) => {
    const { html, status, error } = await fetchWithRetry(url, { useCache: !noCache });
    if (!html) {
      failures.push({ url, reason: error ?? `HTTP ${status}` });
      return;
    }
    const parsed = parseCoursePage(html, url);
    if (parsed.error) {
      failures.push({ url, reason: parsed.error });
      return;
    }
    courses.push(parsed);
  },
  (done, total) => {
    if (done % 40 === 0 || done === total) console.log(`  ${done}/${total}`);
  },
);

await writeFile(outPath, toCsv(courses), 'utf8');

const rated = courses.filter((course) => course.rating !== null);
console.log(`\nFetched ${courses.length} courses, ${failures.length} failed.`);
console.log(`  with ratings: ${rated.length}`);
console.log(`  with skills:  ${courses.filter((c) => c.skills.length > 0).length}`);
console.log(`  with reviews: ${courses.filter((c) => c.reviewComments.length > 0).length}`);
console.log(`\nWrote ${outPath}`);
console.log('\nNext:');
console.log(`  npm run build:coursera -- ${outPath}`);
console.log('  npm run verify:coursera');

if (failures.length > 0) {
  console.log(`\n${failures.length} failed:`);
  for (const failure of failures.slice(0, 20)) {
    console.log(`  ${failure.reason.padEnd(18)} ${failure.url}`);
  }
  if (failures.length > 20) console.log(`  …and ${failures.length - 20} more`);
  console.log(
    '\nHTTP 404 means the course was retired — add the slug to scripts/coursera-denylist.json.',
  );
}
