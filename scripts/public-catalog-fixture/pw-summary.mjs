#!/usr/bin/env node
// ABOUTME: Sanitized Playwright summary for the evidence directory: project, file:line, test title and status only. No error
// ABOUTME: messages, attachments, stdout or page text are copied out of the private JSON report.
import { readFileSync } from 'node:fs';
const r = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = [];
const walk = (s) => { for (const c of s.specs ?? []) for (const t of c.tests ?? []) out.push(`${t.projectName}|${c.file}:${c.line}|${c.title}|${t.results?.at(-1)?.status ?? 'none'}`); for (const x of s.suites ?? []) walk(x); };
for (const s of r.suites ?? []) walk(s);
console.log(out.sort().join('\n'));
