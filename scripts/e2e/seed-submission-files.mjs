// ABOUTME: Uploads the two fixture files that e2e/fixtures/seed.sql references
// ABOUTME: from public.submission_attachments — SQL cannot write to storage.
//
// The rows in seed.sql hold object paths inside the private `course-documents`
// bucket; the grader signs each one at click time. This script signs in as the
// e2e member (the owner of the fixture submission, so the per-user storage
// policy applies unchanged) and puts the objects at exactly those paths.
//
// Idempotent: upsert is on, so re-running just overwrites the same two objects.
//
// Usage: node scripts/e2e/seed-submission-files.mjs
// Credentials come from the process env, not .env (.env is a template with empty
// values): E2E_MEMBER_PASSWORD, or the shared E2E_TEST_PASSWORD that
// e2e/global-setup.ts falls back to for every role.
import { createClient } from '@supabase/supabase-js';

const COURSE_ID = '660e8400-e29b-41d4-a716-446655440001';
const BUCKET = 'course-documents';

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.E2E_MEMBER_EMAIL || 'e2e-member@insightscollective.org';
const password = process.env.E2E_MEMBER_PASSWORD || process.env.E2E_TEST_PASSWORD;

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}
if (!password) {
  console.error('Missing E2E_MEMBER_PASSWORD / E2E_TEST_PASSWORD (process env, not .env)');
  process.exit(1);
}

// A 1x1 PNG and a minimal one-page PDF. Real bytes of the declared type, so the
// bucket's MIME allowlist and the grader's image/PDF preview both behave as they
// do for a genuine student upload.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF
`,
  'utf8',
);

const supabase = createClient(url, anon);

const { data: auth, error: signInError } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (signInError) {
  console.error('Sign-in failed:', signInError.message);
  process.exit(1);
}

const userId = auth.user.id;
const files = [
  { name: 'e2e-fixture-chart.png', body: PNG, contentType: 'image/png' },
  { name: 'e2e-fixture-writeup.pdf', body: PDF, contentType: 'application/pdf' },
];

let failed = false;
for (const file of files) {
  const path = `submissions/${COURSE_ID}/${userId}/${file.name}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.body, { contentType: file.contentType, upsert: true });
  if (error) {
    failed = true;
    console.error(`FAILED ${path}: ${error.message}`);
  } else {
    console.log(`ok ${path}`);
  }
}

await supabase.auth.signOut();
process.exit(failed ? 1 : 0);
