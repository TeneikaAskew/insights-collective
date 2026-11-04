#!/usr/bin/env node
// ABOUTME: Sanitized Playwright summary for the evidence directory: project, file:line, test title and status, plus, for a test
// ABOUTME: that did not pass, the FIXED title of its deepest failed step when that title is on the allowlist. Never a message.
// No error messages, attachments, stdout or page text are copied out of the private JSON report. A failed step whose title is
// not on the allowlist is reported as UNLISTED; a failure outside every step as UNSTEPPED.
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const STEP_RE = /^(a4_(load|tab_reach|open|arrow|select_url|cards|back|forward)|a8_(load|open_card|heading|estimate|public_module|hidden_module)|net_(settled|app_failed|unbound|foreign|pageerror))$/;
/** On the failing path (depth-first, first step with an error), the DEEPEST step whose title is allowlisted; matcher or other
 *  unlisted steps nested under it are skipped. A failing path with no allowlisted step is UNLISTED; no failing step is null. */
export function failedStep(steps) {
  for (const st of steps ?? []) {
    if (!st || !st.error) continue;
    const inner = failedStep(st.steps);
    if (inner && inner !== 'UNLISTED') return inner;
    return STEP_RE.test(String(st.title)) ? st.title : 'UNLISTED';
  }
  return null;
}
export function summarize(r) {
  const out = [];
  const walk = (s) => {
    for (const c of s.specs ?? []) for (const t of c.tests ?? []) {
      const last = t.results?.at(-1);
      const status = last?.status ?? 'none';
      let line = `${t.projectName}|${c.file}:${c.line}|${c.title}|${status}`;
      if (last && status !== 'passed' && status !== 'skipped') line += `|step=${failedStep(last.steps) ?? 'UNSTEPPED'}`;
      out.push(line);
    }
    for (const x of s.suites ?? []) walk(x);
  };
  for (const s of r.suites ?? []) walk(s);
  return out.sort().join('\n');
}
const isMain = (() => { try { return realpathSync(process.argv[1] ?? '') === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) console.log(summarize(JSON.parse(readFileSync(process.argv[2], 'utf8'))));
