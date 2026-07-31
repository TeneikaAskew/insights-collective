// ABOUTME: Emits the seed migration for public.coursera_subject_keywords and
// ABOUTME: public.coursera_courses from the two files that are canonical in the repo:
// ABOUTME: src/data/subjectKeywords.json and src/data/courseraCatalog.generated.ts.
// ABOUTME: Usage: npm run emit:coursera-seed -- <output.sql>
//
// The keyword table exists so the Edge Function can classify a freshly fetched
// course without a copy of the keyword list baked into its bundle. Keeping the JSON
// canonical and generating the rows means there is still one place to edit.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const KEYWORDS_PATH = resolve(here, '../src/data/subjectKeywords.json');
const CATALOG_PATH = resolve(here, '../src/data/courseraCatalog.generated.ts');

/** Postgres string literal. Doubling single quotes is the whole escape rule. */
const lit = (value) => `'${String(value).replace(/'/g, "''")}'`;
const nullable = (value) =>
  value === null || value === undefined || value === '' ? 'null' : value;
const textArray = (values) => `ARRAY[${values.map(lit).join(', ')}]::text[]`;

/**
 * Read the generated catalog without importing it — this is a plain Node script and
 * the catalog is TypeScript. Field order in the generated file is fixed by its
 * emitter, so a positional parse is safe here.
 */
async function readCatalog() {
  const source = await readFile(CATALOG_PATH, 'utf8');
  const blocks = source.split(/\n  \{\n/).slice(1);

  return blocks
    .map((block) => {
      const str = (field) => {
        const match = new RegExp(`${field}: "((?:[^"\\\\]|\\\\.)*)"`).exec(block);
        return match ? JSON.parse(`"${match[1]}"`) : null;
      };
      const num = (field) => {
        const match = new RegExp(`${field}: ([0-9.]+)`).exec(block);
        return match ? Number(match[1]) : null;
      };
      const arr = (field) => {
        const match = new RegExp(`${field}: \\[([^\\]]*)\\]`).exec(block);
        if (!match || !match[1].trim()) return [];
        return [...match[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`));
      };

      return {
        slug: str('slug'),
        url: str('url'),
        title: str('title'),
        partner: str('partner'),
        format: str('format'),
        level: str('level'),
        rating: num('rating'),
        reviews: num('reviews'),
        subjects: arr('subjects'),
        primarySubjects: arr('primarySubjects'),
        skills: arr('skills'),
        description: str('description'),
      };
    })
    .filter((course) => course.slug && course.url && course.partner);
}

const outPath = process.argv[2];
if (!outPath) {
  console.error('Usage: npm run emit:coursera-seed -- <output.sql>');
  process.exit(1);
}

const keywordsRaw = JSON.parse(await readFile(KEYWORDS_PATH, 'utf8'));
const keywordRows = Object.entries(keywordsRaw)
  .filter(([subject]) => !subject.startsWith('$'))
  .flatMap(([subject, keywords]) => keywords.map((keyword) => ({ subject, keyword })));

const catalog = await readCatalog();
if (catalog.length === 0) {
  console.error('Parsed 0 courses from the generated catalog — has its format changed?');
  process.exit(1);
}

const keywordValues = keywordRows
  .map((row) => `  (${lit(row.subject)}, ${lit(row.keyword)})`)
  .join(',\n');

const courseValues = catalog
  .map(
    (course) =>
      `  (${lit(course.slug)}, ${lit(course.url)}, ${lit(course.title)}, ${lit(course.partner)}, ` +
      `${lit(course.format)}, ${lit(course.level)}, ${nullable(course.rating)}, ` +
      `${nullable(course.reviews)}, ${textArray(course.subjects)}, ` +
      `${textArray(course.primarySubjects)}, ${textArray(course.skills)}, ` +
      `${lit(course.description ?? '')})`,
  )
  .join(',\n');

const sql = `-- ABOUTME: GENERATED FILE — do not edit by hand. Regenerate with:
-- ABOUTME:   npm run emit:coursera-seed -- <this file>
-- ABOUTME: Seeds the subject keyword table and the initial Coursera catalog from
-- ABOUTME: src/data/subjectKeywords.json and src/data/courseraCatalog.generated.ts,
-- ABOUTME: which stay canonical in the repo.
--
-- ${keywordRows.length} keyword rows, ${catalog.length} courses.
--
-- Idempotent by design. Keywords are replaced wholesale, since the JSON is the only
-- source and a stale keyword would mean a stale classification. Courses use DO
-- NOTHING: after the first run the Edge Function owns these rows, and re-running a
-- migration must never roll a live catalog back to its seed values.
--
-- ON CONFLICT with no target on purpose. Naming a column would pin this file to
-- whichever constraint happens to be the identity when it runs, and that changed
-- once already (slug -> url). Untargeted DO NOTHING is correct under either.

-- ── Subject keywords ────────────────────────────────────────────────────────
DELETE FROM public.coursera_subject_keywords;

INSERT INTO public.coursera_subject_keywords (subject, keyword) VALUES
${keywordValues};

-- ── Initial catalog ─────────────────────────────────────────────────────────
INSERT INTO public.coursera_courses
  (slug, url, title, partner, format, level, rating, reviews, subjects, primary_subjects, skills, description)
VALUES
${courseValues}
ON CONFLICT DO NOTHING;
`;

await writeFile(resolve(process.cwd(), outPath), sql, 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`  ${keywordRows.length} keyword rows across ${new Set(keywordRows.map((r) => r.subject)).size} subjects`);
console.log(`  ${catalog.length} courses`);
