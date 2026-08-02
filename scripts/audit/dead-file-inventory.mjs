#!/usr/bin/env node
// ABOUTME: Lists files under src/ that nothing references, by RESOLVING import
// ABOUTME: specifiers to real paths rather than grepping for basenames.
//
// WHY THIS EXISTS, AND WHY IT SELF-TESTS
//
// This script decides what a deletion PR is allowed to delete, so being subtly
// wrong here is worse than being wrong almost anywhere else in the repo. The
// first version of this inventory was an ad-hoc shell loop, and it reported
// `src/components/ui/button.tsx` and `src/components/ProtectedRoute.tsx` as
// unreferenced — two files imported on nearly every screen. The cause was a
// regex containing `[^\n]*`: in POSIX ERE a bracket expression is literal, so
// `[^\n]` means "not a backslash and not the letter n", NOT "not a newline".
// Every import line containing the letter `n` was invisible to it. Had that
// output been trusted, the design system would have been deleted.
//
// So this file does two things differently:
//   1. It resolves specifiers to paths (alias, relative, extension, index
//      files) instead of matching names, which removes the whole class of
//      near-miss regex bugs.
//   2. It refuses to report anything until it has proved it can see a set of
//      files known to be alive — SELF_TEST_LIVE below. A detector that cannot
//      find `button.tsx` has no business naming deletion candidates.
//
// It is a STARTING LIST, not a verdict. Everything it reports still needs the
// per-file protocol: check exported identifiers (a barrel re-export is by name,
// never by path), check for dynamic/computed imports, and check that the
// capability the file provides exists elsewhere or is knowingly dropped.

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Files that are definitely alive. If any of these lands in the dead list the
 * detector is broken and the run aborts rather than emitting a list somebody
 * might act on. Each entry covers a distinct way of being referenced:
 */
const SELF_TEST_LIVE = [
  // ordinary aliased import, used everywhere
  'src/components/ui/button.tsx',
  'src/components/ProtectedRoute.tsx',
  // imported WITH an extension — `import App from './App.tsx'` (main.tsx)
  'src/App.tsx',
  // referenced from HTML, never imported — index.html's module script
  'src/main.tsx',
  // referenced from a config file as a bare string — vitest setupFiles
  'src/test/setup.ts',
];

const SOURCE_DIRS = ['src', 'e2e', 'scripts', 'supabase'];
/** Non-import references live in these; scan every quoted string in them. */
const STRING_REF_FILES = [
  'index.html',
  'package.json',
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
  'tailwind.config.ts',
  'eslint.config.js',
];

const CODE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const CANDIDATE_EXT = ['.ts', '.tsx'];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Every extension/index permutation a specifier might mean. */
function resolveCandidates(base) {
  return [
    base,
    ...CODE_EXT.map(e => base + e),
    ...CODE_EXT.map(e => join(base, 'index' + e)),
    // `./App.tsx` — already has the extension, so `base` above covers it.
  ];
}

function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('/src/')) base = join(ROOT, spec.slice(1));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // bare package specifier
  for (const c of resolveCandidates(base)) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

// `from '…'`, `import('…')`, `require('…')`, and bare `import '…'`.
const SPECIFIER = [/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"\n]+)['"]/g];

// Any quoted string, for HTML/config files where references are not imports.
//
// TWO passes, one per quote character, each anchored to a single line. A single
// combined `['"]([^'"]{2,200})['"]` pattern is wrong in two ways that cancel out
// into silent nonsense: `[^'"]` spans newlines, and a string longer than the
// bound cannot match — so index.html's long CSP meta value was skipped, its
// quotes were swallowed as content, and every later pair flipped phase. The
// scan then captured the text BETWEEN attribute values (` src=`, ` type=`)
// instead of the values, which is why `/src/main.tsx` was never seen. Splitting
// by quote character means an apostrophe inside a double-quoted value is just
// content, and `\n` exclusion keeps a mismatch on one line from corrupting the
// rest of the file.
const ANY_STRING = [/"([^"\n]+)"/g, /'([^'\n]+)'/g];

const referenced = new Set();

function scanFile(file, patterns) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const target = resolveSpecifier(m[1], file);
      if (target && target !== file) referenced.add(target);
    }
  }
}

for (const dir of SOURCE_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    if (!CODE_EXT.some(e => file.endsWith(e))) continue;
    scanFile(file, SPECIFIER);
  }
}
for (const name of STRING_REF_FILES) {
  const file = join(ROOT, name);
  if (existsSync(file)) scanFile(file, ANY_STRING);
}

/**
 * Test files are ENTRY POINTS, not dependencies: vitest discovers them by glob,
 * so nothing imports them and every one of them would otherwise be reported as
 * dead. Excluding them here is not the same as saying they cannot be dead — a
 * test whose subject has been deleted is dead too — but that is a question about
 * the subject, decided when the subject is deleted, not a reference question.
 */
const isTestFile = f =>
  f.includes('/__tests__/') || /\.(test|spec)\.[jt]sx?$/.test(f);

const candidates = walk(join(ROOT, 'src'))
  .filter(f => CANDIDATE_EXT.some(e => f.endsWith(e)))
  .filter(f => !f.endsWith('.d.ts'))
  .filter(f => !isTestFile(f));

const dead = candidates.filter(f => !referenced.has(f)).map(f => relative(ROOT, f)).sort();

// ── Self-test ────────────────────────────────────────────────────────────────
const wronglyDead = SELF_TEST_LIVE.filter(f => dead.includes(f));
if (wronglyDead.length) {
  console.error('DETECTOR IS BROKEN — these files are alive but were reported dead:');
  for (const f of wronglyDead) console.error('  ' + f);
  console.error('\nRefusing to emit a candidate list. Fix the resolver first.');
  process.exit(1);
}
const missingFixtures = SELF_TEST_LIVE.filter(f => !existsSync(join(ROOT, f)));
if (missingFixtures.length) {
  console.error('Self-test fixtures no longer exist; update SELF_TEST_LIVE:');
  for (const f of missingFixtures) console.error('  ' + f);
  process.exit(1);
}

console.log(`Self-test passed (${SELF_TEST_LIVE.length} known-live files all seen as referenced).`);
console.log(`\n${dead.length} of ${candidates.length} files under src/ have no resolvable reference:\n`);
for (const f of dead) console.log('  ' + f);
console.log(
  '\nThis is a STARTING LIST. Before deleting any of these, check exported ' +
    'identifiers (barrel re-exports reference by name, not path), dynamic or ' +
    'computed imports, and whether the capability exists elsewhere.',
);
