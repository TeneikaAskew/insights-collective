// ABOUTME: Generates src/data/courseraCatalog.generated.ts from a Coursera catalog
// ABOUTME: CSV export. Coursera has no free public catalog API, so the input is a
// ABOUTME: dataset snapshot rather than a live fetch — see the header it writes for
// ABOUTME: provenance. Usage: npm run build:coursera -- <path-to-csv>
//
// Why generated rather than hand-written: the previous hand-curated table guessed
// URL paths, and 11 of 34 entries were wrong — Coursera serves professional
// certificates from /professional-certificates/, not /specializations/. The CSV
// carries the real URL, so nothing has to be inferred.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(here, '../src/data/courseraCatalog.generated.ts');
const KEYWORDS_PATH = resolve(here, '../src/data/subjectKeywords.json');
const DENYLIST_PATH = resolve(here, './coursera-denylist.json');

/** Keep at most this many courses per subject. The UI shows at most 4 per role. */
const PER_SUBJECT_LIMIT = 8;
/** A course needs this rating to be worth recommending. */
const MIN_RATING = 4.3;
/** …backed by at least this many reviews, so a lone 5.0 does not win. */
const MIN_REVIEWS = 50;
/** Truncate descriptions to keep the shipped bundle small. */
const MAX_DESCRIPTION = 180;

// ---------------------------------------------------------------------------
// CSV parsing (RFC 4180: quoted fields, embedded commas, newlines, "" escapes)
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  return body
    .filter((cells) => cells.length >= header.length)
    .map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ''])));
}

// ---------------------------------------------------------------------------
// Subject inference — must stay behaviourally identical to inferSubjects() in
// src/data/learningSubjects.ts. Both read subjectKeywords.json, and
// roleCourseResolver.test.ts re-derives every generated row to catch drift.
// ---------------------------------------------------------------------------

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadSubjectPatterns() {
  const raw = JSON.parse(await readFile(KEYWORDS_PATH, 'utf8'));
  return Object.entries(raw)
    .filter(([subject]) => !subject.startsWith('$'))
    .map(([subject, keywords]) => [
      subject,
      keywords.map(
        (keyword) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`, 'i'),
      ),
    ]);
}

function inferSubjects(patterns, ...fragments) {
  const haystack = fragments.filter(Boolean).join(' \n ');
  if (!haystack.trim()) return [];
  return patterns
    .filter(([, regexes]) => regexes.some((regex) => regex.test(haystack)))
    .map(([subject]) => subject);
}

// ---------------------------------------------------------------------------
// Row normalization
// ---------------------------------------------------------------------------

/** The dataset stores Skills as a stringified Python list. */
function parseSkills(raw) {
  if (!raw || raw === '[]') return [];
  const matches = [...raw.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)];
  const skills = matches.map((match) => (match[1] ?? match[2]).replace(/\\(.)/g, '$1').trim());
  return [...new Set(skills.filter(Boolean))];
}

function parseNumber(raw) {
  const cleaned = String(raw ?? '').replace(/[^0-9.]/g, '');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** "Beginner level" -> "Beginner". Unlabelled rows are treated as Intermediate. */
function parseLevel(raw) {
  const match = /(beginner|intermediate|advanced)/i.exec(raw ?? '');
  if (!match) return 'Intermediate';
  return match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
}

/**
 * Format and slug come from the URL path, which is authoritative — this is the
 * exact thing the hand-curated table got wrong.
 */
function parseUrl(raw) {
  const match = /coursera\.org\/(learn|specializations|professional-certificates)\/([^/?#]+)/.exec(
    raw ?? '',
  );
  if (!match) return null;
  const formats = {
    learn: 'Course',
    specializations: 'Specialization',
    'professional-certificates': 'Professional Certificate',
  };
  return {
    slug: match[2],
    format: formats[match[1]],
    // Rebuild rather than passing the raw value through: strips tracking params
    // and guarantees a canonical, https URL.
    url: `https://www.coursera.org/${match[1]}/${match[2]}`,
  };
}

function truncate(text, limit) {
  const collapsed = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (collapsed.length <= limit) return collapsed;
  const cut = collapsed.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > limit * 0.6 ? lastSpace : limit).trimEnd()}…`;
}

/**
 * Ranking score. Rating alone puts a 5.0/12-reviews course above a
 * 4.8/300,000-reviews one, so weight by log of the audience — the standard fix
 * for sparse-rating bias, and enough for picking 8 courses per subject.
 */
function qualityScore(course) {
  const reviews = course.reviews ?? 0;
  const enrolled = course.enrolled ?? 0;
  return course.rating * Math.log10(10 + reviews) * (1 + Math.log10(10 + enrolled) / 10);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: npm run build:coursera -- <path-to-coursera-csv>');
  console.error(
    '\nExpected columns: title, Organization, Skills, Description, Level, URL, rating,\n' +
      'num_reviews, enrolled. The azrai99/coursera-course-dataset export on Hugging Face\n' +
      'matches this shape.',
  );
  process.exit(1);
}

const patterns = await loadSubjectPatterns();
const denylist = new Set(
  JSON.parse(await readFile(DENYLIST_PATH, 'utf8')).denied.map((entry) => entry.slug),
);
const rows = parseCsv(await readFile(resolve(process.cwd(), csvPath), 'utf8'));
console.log(`Parsed ${rows.length} rows from ${basename(csvPath)}`);

const normalized = [];
const seenSlugs = new Set();
const rejected = { badUrl: 0, lowRated: 0, noSubjects: 0, duplicate: 0, denied: 0, noPartner: 0 };

for (const row of rows) {
  const parsedUrl = parseUrl(row.URL);
  if (!parsedUrl) {
    rejected.badUrl += 1;
    continue;
  }
  // Retired courses are still in the snapshot; without this they come back on
  // every regeneration. `npm run verify:coursera` finds them.
  if (denylist.has(parsedUrl.slug)) {
    rejected.denied += 1;
    continue;
  }
  if (seenSlugs.has(parsedUrl.slug)) {
    rejected.duplicate += 1;
    continue;
  }

  const rating = parseNumber(row.rating);
  const reviews = parseNumber(row.num_reviews);
  if (rating === null || rating < MIN_RATING || (reviews ?? 0) < MIN_REVIEWS) {
    rejected.lowRated += 1;
    continue;
  }

  // Drop rows with no authoring organization rather than substituting a
  // placeholder. Attribution is the one field a course directory cannot fake, and
  // a silent "Coursera" default is indistinguishable from the real "Coursera
  // Instructor Network" partner.
  const partner = truncate(row.Organization, 80);
  if (!partner || partner === 'Coursera') {
    rejected.noPartner += 1;
    continue;
  }

  // Slice BEFORE inferring, not after. Inferring from all skills but shipping
  // only the first 8 produced rows whose stored subjects could not be re-derived
  // from their stored fields — the drift test in roleCourseResolver.test.ts caught
  // exactly that. Everything the subjects were derived from has to survive here.
  const skills = parseSkills(row.Skills).slice(0, 8);
  const title = truncate(row.title, 120);
  const description = truncate(row.Description, MAX_DESCRIPTION);
  const skillsText = skills.join(', ');

  // Infer from title and Coursera's own skill tags ONLY — deliberately not the
  // description. Descriptions are marketing prose that name-drop everything
  // adjacent, which produced real nonsense: an Academic English writing course
  // classified as `research`, a UX course as `research`, AWS Fundamentals as
  // `data-analysis`. Title plus curated skill tags is the high-signal subset.
  const subjects = inferSubjects(patterns, title, skillsText);
  if (subjects.length === 0) {
    rejected.noSubjects += 1;
    continue;
  }

  // Subjects named in the TITLE are what the course is about; subjects found only
  // in skill tags are things it touches. Without this split, ranking by rating and
  // audience alone handed the `software-engineering` slot to "Neural Networks and
  // Deep Learning" (its skills list Python programming, and it has enormous review
  // counts) and the `generative-ai` slot to a social media marketing certificate.
  const primarySubjects = inferSubjects(patterns, title);

  seenSlugs.add(parsedUrl.slug);
  normalized.push({
    ...parsedUrl,
    title,
    partner,
    level: parseLevel(row.Level),
    rating,
    reviews: reviews ?? 0,
    enrolled: parseNumber(row.enrolled),
    skills,
    description,
    subjects,
    primarySubjects,
  });
}

console.log(
  `Kept ${normalized.length} candidates ` +
    `(dropped ${rejected.badUrl} unparseable URL, ${rejected.lowRated} below the quality bar, ` +
    `${rejected.noSubjects} with no recognised subject, ${rejected.duplicate} duplicate, ` +
    `${rejected.denied} denylisted, ${rejected.noPartner} missing a partner)`,
);

// Take the best PER_SUBJECT_LIMIT for each subject, preferring courses the subject
// is central to before falling back to ones that merely touch it. A course kept for
// one subject carries all its subjects along, so sparse subjects still benefit.
const selected = new Map();

for (const subject of patterns.map(([name]) => name)) {
  const candidates = normalized
    .filter((course) => course.subjects.includes(subject))
    .sort((a, b) => {
      const aPrimary = a.primarySubjects.includes(subject) ? 1 : 0;
      const bPrimary = b.primarySubjects.includes(subject) ? 1 : 0;
      return bPrimary - aPrimary || qualityScore(b) - qualityScore(a);
    })
    .slice(0, PER_SUBJECT_LIMIT);

  for (const course of candidates) {
    if (!selected.has(course.slug)) selected.set(course.slug, course);
  }
}

const catalog = [...selected.values()].sort((a, b) => a.slug.localeCompare(b.slug));

console.log(`\nSelected ${catalog.length} courses. Coverage per subject:`);
for (const [subject] of patterns) {
  const count = catalog.filter((course) => course.subjects.includes(subject)).length;
  console.log(`  ${count === 0 ? '!! ' : '   '}${subject.padEnd(22)} ${count}`);
}

const emptySubjects = patterns
  .map(([name]) => name)
  .filter((subject) => !catalog.some((course) => course.subjects.includes(subject)));

const body = catalog
  .map((course) => {
    const quote = (value) => JSON.stringify(value);
    return `  {
    slug: ${quote(course.slug)},
    url: ${quote(course.url)},
    title: ${quote(course.title)},
    partner: ${quote(course.partner)},
    format: ${quote(course.format)},
    level: ${quote(course.level)},
    rating: ${course.rating},
    reviews: ${course.reviews},
    subjects: [${course.subjects.map(quote).join(', ')}],
    primarySubjects: [${course.primarySubjects.map(quote).join(', ')}],
    skills: [${course.skills.map(quote).join(', ')}],
    description: ${quote(course.description)},
  },`;
  })
  .join('\n');

const output = `// ABOUTME: GENERATED FILE — do not edit by hand. Regenerate with:
// ABOUTME:   npm run build:coursera -- <path-to-coursera-csv>
// ABOUTME: Source: a Coursera catalog CSV snapshot (Coursera retired its free
// ABOUTME: public catalog API, so there is nothing live to query). Course titles,
// ABOUTME: partners, levels and URLs are Coursera's; this file is a filtered index
// ABOUTME: kept only so the app can link out to them.
//
// Generated from ${basename(csvPath)}: ${rows.length} rows in, ${catalog.length} courses kept.
// Selection: rating >= ${MIN_RATING} with >= ${MIN_REVIEWS} reviews, top ${PER_SUBJECT_LIMIT} per subject
// by rating weighted by audience size.
//
// Slugs go stale as courses are retired. \`npm run verify:coursera\` re-checks every
// URL and reports the dead ones.

import type { CourseraCourse } from './courseraCatalog';

export const generatedCourseraCatalog: CourseraCourse[] = [
${body}
];
`;

await writeFile(OUTPUT_PATH, output, 'utf8');
console.log(`\nWrote ${OUTPUT_PATH}`);

if (emptySubjects.length > 0) {
  console.log(
    `\nWARNING: no course covers ${emptySubjects.join(', ')} — roles needing those ` +
      'subjects will fall through to whatever else their path lists.',
  );
}
