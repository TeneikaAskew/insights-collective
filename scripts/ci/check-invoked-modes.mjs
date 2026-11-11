#!/usr/bin/env node
// ABOUTME: Static check: every repository script a workflow runs DIRECTLY by path (not through node/bash/sh/npx/deno) is
// ABOUTME: committed executable (git mode 100755) and starts with a shebang. Catches the exit-126 failure of run 41340995609.
// Usage: node scripts/ci/check-invoked-modes.mjs <workflow.yml>...   Exit 0 ok, 1 problems, 2 usage.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import YAML from 'yaml';

const INTERP = /^(node|bash|sh|zsh|npx|deno|python3?|tsx|env)$/;
const PATH_RE = /^(?:\.\/)?(scripts\/[A-Za-z0-9_./-]+)$/;

/** Every `run:` text of every step in every job. */
export function runBlocks(yamlText) {
  const doc = YAML.parse(yamlText);
  const out = [];
  for (const [job, j] of Object.entries(doc?.jobs ?? {})) for (const s of j?.steps ?? []) if (typeof s?.run === 'string') out.push({ job, step: s.name ?? '', run: s.run });
  return out;
}

/** Repository paths in command position: start of a line or after | || && ; ( $( ` ! if then else do while until time. */
export function directInvocations(run) {
  const found = new Set();
  for (const raw of run.split('\n')) {
    const line = raw.replace(/^\s*#.*$/, '');
    // split into simple commands on control operators, keep the first word of each
    for (const seg of line.split(/\|\||&&|[|;)]|\$\(|`|\(/)) {
      const words = seg.trim().split(/\s+/).filter(Boolean);
      while (words.length && /^(!|if|then|else|elif|do|while|until|time|exec|[A-Za-z_][A-Za-z0-9_]*=\S*)$/.test(words[0])) words.shift();
      if (!words.length || INTERP.test(words[0])) continue;
      const m = words[0].replace(/["']/g, '').match(PATH_RE);
      if (m) found.add(m[1]);
    }
  }
  return [...found];
}

export function problems(paths, modeOf, firstLine) {
  const out = [];
  for (const p of paths) {
    const mode = modeOf(p);
    if (mode === null) out.push(`${p}: not tracked by git`);
    else if (mode !== '100755') out.push(`${p}: invoked directly but committed as ${mode} (needs 100755)`);
    if (mode !== null && !String(firstLine(p) ?? '').startsWith('#!')) out.push(`${p}: invoked directly but has no shebang`);
  }
  return out;
}

const gitMode = (p) => { const o = execFileSync('git', ['ls-files', '-s', '--', p], { encoding: 'utf8' }).trim(); return o ? o.split(/\s+/)[0] : null; };
const first = (p) => { try { return fs.readFileSync(p, 'utf8').split('\n')[0]; } catch { return null; } };

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const files = process.argv.slice(2);
  if (!files.length) { console.log('usage: check-invoked-modes.mjs <workflow.yml>...'); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    const paths = [...new Set(runBlocks(fs.readFileSync(f, 'utf8')).flatMap((b) => directInvocations(b.run)))].sort();
    const p = problems(paths, gitMode, first);
    for (const x of p) console.log(`FAIL ${f}: ${x}`);
    if (!p.length) console.log(`invoked modes ${f}: ok (${paths.length} directly invoked script(s), all 100755 with a shebang)`);
    bad += p.length;
  }
  process.exit(bad ? 1 : 0);
}
