#!/usr/bin/env node
// ABOUTME: Fixed-format summaries for run.sh: Playwright JSON -> one count line with test titles (no values, paths or
// ABOUTME: errors), and an exact pre/post witness comparison. Exits 1 on failure; prints nothing raw.
import fs from 'node:fs';

const [mode, a, b] = process.argv.slice(2);
if (mode === 'playwright') {
  const r = JSON.parse(fs.readFileSync(a, 'utf8'));
  const tests = [];
  const walk = (s, proj) => {
    for (const spec of s.specs ?? []) for (const t of spec.tests ?? []) tests.push({ title: spec.title, project: t.projectName, status: t.status });
    for (const c of s.suites ?? []) walk(c, proj);
  };
  for (const s of r.suites ?? []) walk(s);
  const by = (k) => tests.filter((t) => t.status === k).length;
  console.log(`PLAYWRIGHT exit=${b} total=${tests.length} expected=${by('expected')} unexpected=${by('unexpected')} flaky=${by('flaky')} skipped=${by('skipped')} globalErrors=${(r.errors ?? []).length}`);
  for (const t of tests.sort((x, y) => `${x.project} ${x.title}`.localeCompare(`${y.project} ${y.title}`))) {
    console.log(`TEST ${t.status === 'expected' ? 'PASS' : 'FAIL'} ${t.project} ${t.title.replace(/[^\w ,.'():/-]/g, '?')}`);
  }
  process.exit(tests.length > 0 && by('expected') === tests.length && (r.errors ?? []).length === 0 && b === '0' ? 0 : 1);
} else if (mode === 'witness') {
  const pre = fs.readFileSync(a, 'utf8');
  const post = fs.readFileSync(b, 'utf8');
  const n = pre.split('\n').filter(Boolean).length;
  if (n === 0) { console.log('WITNESS empty'); process.exit(1); }
  if (pre === post) { console.log(`WITNESS unchanged lines=${n}`); process.exit(0); }
  const pl = new Set(pre.split('\n')); const ql = new Set(post.split('\n'));
  const changed = [...new Set([...pre.split('\n').filter((l) => !ql.has(l)), ...post.split('\n').filter((l) => !pl.has(l))])].map((l) => l.split(' ')[0]);
  console.log(`WITNESS CHANGED kinds=${[...new Set(changed)].sort().join(',')}`);
  process.exit(1);
} else {
  console.error('usage: summary.mjs playwright <json> <exit> | witness <pre> <post>');
  process.exit(2);
}
