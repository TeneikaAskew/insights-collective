// ABOUTME: Loads a fetched Coursera CSV into public.coursera_courses. This is the
// ABOUTME: bulk path — it populates the whole corpus in minutes instead of waiting
// ABOUTME: ~18 hours for the Edge Function's cron to drain a full crawl queue. Use it
// ABOUTME: for the initial load and after a local `fetch:coursera --all` sweep.
// ABOUTME: Usage: npm run load:coursera -- <csv> [--dry-run] [--limit N]
//
// Requires a service-role key, because writing this table is deliberately not
// something a browser role can do:
//
//   export SUPABASE_URL=https://<project-ref>.supabase.co
//   export SUPABASE_SERVICE_ROLE_KEY=<service role key>
//
// Never commit that key or pass it on the command line, where it lands in shell
// history. The Edge Function needs no such handling — it already has the key in its
// own environment — which is the whole reason the recurring refresh lives there
// rather than in CI.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  parseCsv,
  parseSkills,
  parseNumber,
  parseLevel,
  parseUrl,
  truncate,
  loadSubjectPatterns,
  inferSubjects,
} from './build-coursera-catalog.mjs';

/** Rows per upsert. Large enough to be fast, small enough to keep bodies sane. */
const CHUNK = 500;
const MAX_DESCRIPTION = 180;
const MAX_SKILLS = 8;

const args = process.argv.slice(2);
const csvPath = args.find((arg) => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const limit = limitArg === -1 ? Infinity : Number(args[limitArg + 1]);

if (!csvPath) {
  console.error('Usage: npm run load:coursera -- <csv> [--dry-run] [--limit N]');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!supabaseUrl || !serviceKey)) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (or pass --dry-run).');
  process.exit(1);
}

const patterns = await loadSubjectPatterns();
const rows = parseCsv(await readFile(resolve(process.cwd(), csvPath), 'utf8'));
console.log(`Parsed ${rows.length} rows`);

const seen = new Set();
const records = [];
const skipped = { badUrl: 0, noPartner: 0, noTitle: 0, duplicate: 0 };

for (const row of rows) {
  if (records.length >= limit) break;

  const parsedUrl = parseUrl(row.URL);
  if (!parsedUrl) {
    skipped.badUrl += 1;
    continue;
  }
  if (seen.has(parsedUrl.slug)) {
    skipped.duplicate += 1;
    continue;
  }

  const title = truncate(row.title, 120);
  if (!title) {
    skipped.noTitle += 1;
    continue;
  }

  // Attribution is not something a course directory may invent, so a row without a
  // partner is dropped rather than defaulted. The column is NOT NULL for the same
  // reason.
  const partner = truncate(row.Organization, 80);
  if (!partner || partner === 'Coursera') {
    skipped.noPartner += 1;
    continue;
  }

  seen.add(parsedUrl.slug);

  // Slice before inferring: subjects must be explainable from the skills stored.
  const skills = parseSkills(row.Skills).slice(0, MAX_SKILLS);
  const skillsText = skills.join(', ');
  const description = truncate(row.Description, MAX_DESCRIPTION);

  records.push({
    slug: parsedUrl.slug,
    url: parsedUrl.url,
    format: parsedUrl.format,
    title,
    partner,
    level: parseLevel(row.Level),
    rating: parseNumber(row.rating),
    reviews: parseNumber(row.num_reviews),
    enrolled: parseNumber(row.enrolled),
    estimated_hours: parseNumber(row.estimated_hours),
    description,
    skills,
    // Title + skills only, never the description — marketing prose name-drops
    // everything adjacent and produced nonsense classifications.
    subjects: inferSubjects(patterns, title, skillsText),
    primary_subjects: inferSubjects(patterns, title),
    top_reviews: safeJson(row.top_reviews),
    last_fetched_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
    last_http_status: 200,
    // status, curator_note and is_featured are deliberately absent: on conflict this
    // must not overwrite an admin's curation with defaults.
  });
}

function safeJson(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const withSubjects = records.filter((record) => record.subjects.length > 0);

console.log(
  `Prepared ${records.length} records ` +
    `(skipped ${skipped.badUrl} bad URL, ${skipped.noPartner} no partner, ` +
    `${skipped.noTitle} no title, ${skipped.duplicate} duplicate)`,
);
console.log(`  ${withSubjects.length} classify into at least one subject`);
console.log(`  ${records.filter((r) => r.rating !== null).length} have a rating`);

if (dryRun) {
  console.log('\n--dry-run: nothing written. Sample record:');
  console.log(JSON.stringify(records[0], null, 2));
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

let written = 0;
for (let i = 0; i < records.length; i += CHUNK) {
  const chunk = records.slice(i, i + CHUNK);
  const { error } = await supabase
    .from('coursera_courses')
    .upsert(chunk, { onConflict: 'slug' });

  if (error) {
    console.error(`\nChunk at ${i} failed: ${error.message}`);
    console.error(`${written} rows were written before this point; re-running is safe.`);
    process.exit(1);
  }

  written += chunk.length;
  if (written % 2000 === 0 || written === records.length) {
    console.log(`  ${written}/${records.length}`);
  }
}

const { count } = await supabase
  .from('coursera_courses')
  .select('slug', { count: 'exact', head: true });

console.log(`\nUpserted ${written} rows. Table now holds ${count ?? '?'} courses.`);
console.log('\nNext: npm run emit:coursera-seed -- <migration.sql> to refresh the committed seed.');
