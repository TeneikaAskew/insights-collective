#!/usr/bin/env node
// ABOUTME: Fails when a model id in the source is decommissioned, or belongs to
// ABOUTME: a provider other than the gateway it is sent to. Pure repo check.
//
// WHY THIS EXISTS
//
// A model id is a string. Nothing in the type system, the linter or the test
// suite knows whether it names something a provider still serves, so a dead id
// sits in the source looking exactly like a live one and only announces itself
// as a runtime error — sometimes not even that.
//
// Both failure modes below actually happened here, and both went unnoticed for
// months:
//
//   1. DECOMMISSIONED. Groq shut down llama3-8b-8192 on 2025-08-30. Three
//      functions kept calling it for eleven months. assistant-ai and
//      evaluate-star-response returned 500s; generate-study-guide called it
//      inside a try/catch that continues on failure, so study guides simply
//      generated without their behavioural questions and nobody saw an error.
//
//   2. WRONG PROVIDER. ResumeChat sent meta-llama/Llama-3-8b-chat-hf — a
//      Together AI id — to the Lovable gateway, which serves only its own ids
//      and answered `400 invalid model`. There is no fallback on that path, so
//      every message in resume chat errored.
//
// An allowlist is deliberately strict: a new model id fails this check until
// someone adds it here, which is the moment to confirm the provider actually
// serves it. That is cheaper than discovering it from a user report.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOTS = ['src', 'supabase/functions', 'scripts'];
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

// Model ids this repo is allowed to send. Adding one is a deliberate act:
// confirm the provider serves it, and that it is reachable from the gateway the
// call site actually posts to.
const ALLOWED = new Map([
  ['openai/gpt-oss-120b', 'Groq — api.groq.com'],
  ['google/gemini-2.5-flash', 'Lovable AI gateway — ai.gateway.lovable.dev'],
  // Third-party fallback inside resume-analyzer. Untested and still under
  // review; listed so the check reflects reality rather than intent.
  ['Meta-Llama-3-8B-Instruct', 'ANWAN — api.awanllm.com'],
]);

// Named so the failure explains itself instead of just saying "not allowed".
const DECOMMISSIONED = new Map([
  ['llama3-8b-8192', 'Groq, shut down 2025-08-30 — replaced by openai/gpt-oss-120b here'],
  ['llama3-70b-8192', 'Groq, shut down 2025-08-30'],
  ['llama-3.3-70b-versatile', 'Groq, shut down 2026-08-16 — replaced by openai/gpt-oss-120b here'],
  ['mixtral-8x7b-32768', 'Groq, shut down 2025-03-20'],
  ['gemma-7b-it', 'Groq, shut down 2024-12-18'],
  ['gemma2-9b-it', 'Groq, shut down 2025-10-08'],
  ['compound-beta', 'Groq legacy alias of groq/compound'],
  ['compound-beta-mini', 'Groq legacy alias of groq/compound-mini; rejects tool calling'],
]);

// Any identifier whose name contains "model", assigned a string literal:
// `model:`, `MODEL =`, `CHAT_MODEL =`, `selectedModel =`.
//
// The obvious pattern — /\b(?:model|MODEL)\s*[:=]/ — silently misses
// CHAT_MODEL, because the character before MODEL is an underscore and \b needs
// a non-word character there. That is exactly the constant ResumeChat used to
// send a Together AI id to the Lovable gateway, so the first draft of this
// check would have missed the bug it was written for. Caught by testing the
// check against both historical failures rather than trusting a green run.
//
// Prose in a comment that names a dead id (this file, for one) is not a call.
const ASSIGNMENT = /[A-Za-z0-9_$]*[Mm][Oo][Dd][Ee][Ll][A-Za-z0-9_$]*\s*[:=]\s*['"`]([^'"`]+)['"`]/g;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXTS.has(extname(full))) yield full;
  }
}

// A model id inside a line comment is documentation, not a request.
function stripLineComments(source) {
  return source
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
}

const problems = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const source = stripLineComments(readFileSync(file, 'utf8'));
    const lines = source.split('\n');
    lines.forEach((line, i) => {
      ASSIGNMENT.lastIndex = 0;
      let match;
      while ((match = ASSIGNMENT.exec(line)) !== null) {
        const id = match[1];
        // Template placeholders and variables are resolved elsewhere.
        if (id.includes('${') || !id.trim()) continue;
        if (ALLOWED.has(id)) continue;
        const dead = DECOMMISSIONED.get(id);
        problems.push({
          file,
          line: i + 1,
          id,
          why: dead
            ? `decommissioned (${dead})`
            : 'not in the allowlist — confirm the provider serves it, then add it to ALLOWED',
        });
      }
    });
  }
}

if (problems.length === 0) {
  console.log(`check:models — ok, ${ALLOWED.size} model ids allowed, none stale`);
  process.exit(0);
}

console.error('check:models FAILED\n');
for (const p of problems) {
  console.error(`  ${p.file}:${p.line}`);
  console.error(`    ${p.id}`);
  console.error(`    ${p.why}\n`);
}
console.error('Allowed model ids:');
for (const [id, where] of ALLOWED) console.error(`  ${id}  (${where})`);
console.error('\nIf a model here is genuinely new, add it to ALLOWED in scripts/check-models.mjs');
console.error('after confirming the provider serves it from the gateway that call site posts to.');
process.exit(1);
