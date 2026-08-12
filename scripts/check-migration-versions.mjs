#!/usr/bin/env node
// ABOUTME: Fails when two migration files share a version, or when a filename
// ABOUTME: carries no usable version. Pure repo check — touches no database.
//
// WHY THIS EXISTS
//
// Supabase records an applied migration by its VERSION — the leading digits of
// the filename — not by the filename itself. Two files sharing one version is
// therefore not a cosmetic clash: whichever runs second is skipped in silence,
// with no error and no warning, and the ledger then claims both are applied.
//
// That happened here. 20260728000000 was carried by both hide_quiz_answer_key
// and prune_page_visibility_dead_paths; the quiz migration ran, the page
// visibility one never did, and it went unnoticed for two weeks because every
// local signal said it had shipped. It surfaced only when someone read
// schema_migrations.name and found the recorded row named after the other file.
//
// db-migrate.yml refuses to apply a pending duplicate, which protects the live
// database but only at apply time — by then the collision is already committed
// and someone has to renumber under pressure. This check runs on every pull
// request, so the collision is caught in the minute it is introduced.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migrations';

// The same derivation db-migrate.yml uses: leading digits, however many there
// are, with a date's worth as the floor. Not "cut at the first underscore" —
// 53 legacy Lovable files are named 20250614185655-10e59561-....sql, and
// cutting at the underscore returns the whole filename for those.
const versionOf = (name) => (name.match(/^\d+/) ?? [''])[0];

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql'));
if (files.length === 0) {
  console.error(`No .sql files found in ${DIR} — is the path right?`);
  process.exit(1);
}

const problems = [];

const unversioned = files.filter((f) => versionOf(f).length < 8);
if (unversioned.length > 0) {
  problems.push(
    'These migration filenames do not start with a version of at least 8 digits:\n' +
      unversioned.map((f) => `    ${join(DIR, f)}`).join('\n')
  );
}

const byVersion = new Map();
for (const f of files) {
  const v = versionOf(f);
  if (v.length < 8) continue;
  byVersion.set(v, [...(byVersion.get(v) ?? []), f]);
}

const collisions = [...byVersion.entries()].filter(([, fs]) => fs.length > 1);
if (collisions.length > 0) {
  problems.push(
    'These versions are carried by more than one migration file. Supabase\n' +
      '  records a version once, so all but one of each group would be applied\n' +
      '  silently never. Renumber all but one — the content need not change:\n' +
      collisions
        .map(([v, fs]) =>
          `    ${v}\n` + fs.map((f) => `      ${join(DIR, f)}`).join('\n')
        )
        .join('\n')
  );
}

if (problems.length > 0) {
  console.error('Migration version check FAILED.\n');
  for (const p of problems) console.error(`  ${p}\n`);
  process.exit(1);
}

console.log(
  `Migration version check passed: ${files.length} files, ` +
    `${byVersion.size} distinct versions, no collisions.`
);
