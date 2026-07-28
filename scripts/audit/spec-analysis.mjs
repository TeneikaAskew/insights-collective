#!/usr/bin/env node
// ABOUTME: Scores every e2e spec on how much it actually proves, and flags the
// ABOUTME: patterns that let a test pass while the feature under it is broken.
//
// The suite reports ~525 passing. That number does not mean 525 verified
// behaviours: grading-interface.spec.ts passes 7/7 against a page that renders
// "Error loading submissions", and quiz-results.spec.ts passes 4/4 while every
// request it triggers returns 400. This script quantifies why.
//
// Usage: node scripts/audit/spec-analysis.mjs

import fs from 'node:fs';
import path from 'node:path';

const E2E = path.resolve('e2e');

function specFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) specFiles(full, out);
    else if (e.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

/**
 * Patterns that make a passing result meaningless. Each is something observed
 * causing a false green in this repo, not a style preference.
 */
const SMELLS = [
  {
    id: 'conditional-guard',
    // `if (await x.count() > 0) { expect(...) }` — a missing element skips the
    // body and the test PASSES. Not a skip; no signal at all.
    re: /if\s*\(\s*(?:await\s+)?[^)]*\.count\(\)[^)]*\)\s*\{/g,
    why: 'assertion body only runs when the element exists; missing UI passes green',
  },
  {
    id: 'instant-visibility-sample',
    // .isVisible().catch(() => false) OUTSIDE expect.poll samples once, before
    // async UI settles. Inside expect.poll it is correct, so those are excluded
    // below by checking for a nearby poll.
    re: /\.isVisible\(\)[\s\S]{0,40}?\.catch\(\s*\(\)\s*=>\s*false\s*\)/g,
    why: 'single sample of an async condition; true state may arrive later',
  },
  {
    id: 'status-only-write',
    // expect(res.ok()) on a PostgREST write. PostgREST answers 200/204 when RLS
    // filtered every row, so the write can have done nothing.
    re: /expect\(\s*\w+\.ok\b[^)]*\)[\s\S]{0,60}?toBeTruthy/g,
    why: 'PostgREST returns 2xx when RLS filtered all rows; write may have done nothing',
  },
  {
    id: 'return-minimal-write',
    re: /return=minimal/g,
    why: 'response carries no row, so the write cannot be verified from it',
  },
  {
    id: 'silent-return',
    re: /if\s*\([^)]*\)\s*\{?\s*return;/g,
    why: 'test aborts to green instead of failing or skipping',
  },
  {
    id: 'test-skip',
    re: /test\.skip\(/g,
    why: 'test does not execute',
  },
  {
    id: 'swallowed-await',
    re: /\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)/g,
    why: 'awaited failure discarded',
  },
  {
    id: 'body-not-empty',
    re: /locator\(['"]body['"]\)\s*\)\s*\.not\.toBeEmpty/g,
    why: 'passes on any rendered page including an error state',
  },
  {
    id: 'shell-only',
    re: /locator\(['"]main[^'"]*['"]\)\s*\)\s*\.toBeVisible/g,
    why: 'asserts the layout shell, not the feature',
  },
];

/**
 * Evidence that a record actually round-tripped: a value read back from the
 * database or a count compared against one. This is the only category that can
 * distinguish a working feature from a page that rendered an error state.
 */
const DATA_PROOF = [
  /return=representation/,
  /expect\([^)]*\)\.toEqual\(/,
  /toHaveLength\(/,
  /\.toBe\(\s*\d+\s*\)/,
  /toHaveCount\(\s*\d+\s*\)/,
  /toBeGreaterThan\(/,
];

/**
 * Evidence about the interface: specific copy, URLs, attributes, pixels. Real
 * signal, but it cannot tell a loaded page from a fallback one — every spec
 * that greps for a generic heading lives here.
 */
const UI_PROOF = [
  /toHaveScreenshot/,
  /toContainText\(/,
  /toHaveAttribute\(/,
  /toHaveValue\(/,
  /toHaveURL\(/,
  /getByRole\(\s*['"]heading['"][^)]*name:/,
];

const rows = [];
for (const file of specFiles(E2E)) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(process.cwd(), file);
  const tests = (text.match(/^\s*test\s*\(/gm) ?? []).length;
  const expects = (text.match(/\bexpect\s*\(/g) ?? []).length;
  const usesPoll = /expect\s*\.\s*poll/.test(text);

  const smells = {};
  for (const s of SMELLS) {
    const n = (text.match(s.re) ?? []).length;
    if (!n) continue;
    // .isVisible().catch inside expect.poll is the correct pattern; only count
    // it as a smell when the file never polls at all.
    if (s.id === 'instant-visibility-sample' && usesPoll) continue;
    smells[s.id] = n;
  }

  const dataProof = DATA_PROOF.filter((r) => r.test(text)).length;
  const uiProof = UI_PROOF.filter((r) => r.test(text)).length;
  const mutates = /request\.(post|patch|put|delete)|\.insert\(|\.update\(|\.delete\(/.test(text);
  const cleansUp = /afterAll|afterEach/.test(text);

  // How much of the file is optional: a test whose only assertions sit inside a
  // count() guard contributes nothing when the element is missing.
  const guards = (smells['conditional-guard'] ?? 0) + (smells['silent-return'] ?? 0);
  const shellOnly = (smells['shell-only'] ?? 0) + (smells['body-not-empty'] ?? 0);
  const skipped = smells['test-skip'] ?? 0;
  const optionalRatio = tests ? Math.min(1, (guards + skipped) / tests) : 1;

  let strength;
  if (shellOnly >= Math.max(1, tests * 0.5) || optionalRatio >= 0.8) strength = 'WEAK';
  else if (dataProof >= 2 && optionalRatio <= 0.34) strength = 'STRONG';
  else if (dataProof >= 1 || uiProof >= 2) strength = 'MEDIUM';
  else strength = 'WEAK';

  rows.push({
    spec: rel,
    tests,
    expects,
    strength,
    dataProof,
    uiProof,
    optionalRatio: Number(optionalRatio.toFixed(2)),
    smells,
    mutatesDb: mutates,
    hasCleanup: mutates ? cleansUp : null,
  });
}

fs.mkdirSync('.e2e-audit', { recursive: true });
fs.writeFileSync('.e2e-audit/spec-analysis.json', JSON.stringify({ specs: rows }, null, 2));

const tally = rows.reduce((a, r) => ((a[r.strength] = (a[r.strength] ?? 0) + 1), a), {});
console.log(`${rows.length} specs, ${rows.reduce((n, r) => n + r.tests, 0)} tests`);
console.log('strength:', JSON.stringify(tally));
const totals = {};
for (const r of rows) for (const [k, v] of Object.entries(r.smells)) totals[k] = (totals[k] ?? 0) + v;
console.log('smell totals:', JSON.stringify(totals, null, 0));
console.log(`mutate DB without cleanup: ${rows.filter((r) => r.mutatesDb && !r.hasCleanup).length}`);
console.log('→ .e2e-audit/spec-analysis.json');
