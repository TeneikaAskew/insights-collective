#!/usr/bin/env node
// ABOUTME: One-time codemod adding eslint-disable + TODO to the 159 existing count-guards.
// ABOUTME: Run once when the rule lands; not part of any build.
//
// The rule in eslint.config.js bans `if (await x.count() > 0) { expect… }`. There
// are 159 of them already, so switching it on would make lint fail everywhere
// and the rule would be reverted within a day. Marking the existing ones lets
// the rule land now and stop new ones, while leaving the backlog visible and
// greppable:
//
//   grep -rn "TODO(count-guard)" e2e/ | wc -l
//
// This is deliberately a codemod rather than a blanket `files:` exclusion. An
// exclusion hides the debt; a per-line TODO counts it.

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const DISABLE = 'eslint-disable-next-line no-restricted-syntax';
const TODO =
  'TODO(count-guard): this passes whether or not the element exists. ' +
  'Assert the expected state, or seed the data and assert unconditionally.';

// eslint exits 1 when it reports errors, which is the normal case here — the
// whole point is that there are 159 of them. Read stdout off the thrown error
// rather than treating a populated report as a failure.
let raw;
try {
  raw = execSync('npx eslint e2e/ -f json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  if (!e.stdout) throw e;
  raw = e.stdout;
}
const report = JSON.parse(raw);

let files = 0;
let added = 0;

for (const file of report) {
  const lines = new Set(
    file.messages.filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.line),
  );
  if (!lines.size) continue;

  const src = fs.readFileSync(file.filePath, 'utf8').split('\n');
  const out = [];

  for (let i = 0; i < src.length; i++) {
    const lineNo = i + 1;
    if (lines.has(lineNo) && !src[i - 1]?.includes(DISABLE)) {
      const indent = src[i].match(/^\s*/)[0];
      out.push(`${indent}// ${TODO}`);
      out.push(`${indent}// ${DISABLE}`);
      added++;
    }
    out.push(src[i]);
  }

  fs.writeFileSync(file.filePath, out.join('\n'));
  files++;
}

console.log(`added ${added} disable(s) across ${files} file(s)`);
