#!/usr/bin/env node
// ABOUTME: Scans src/ for every Supabase data access and emits a JSON inventory.
// ABOUTME: Pairs with replay-queries.mjs, which validates each entry against the live DB.
//
// Static scanning alone is NOT a verdict. src/integrations/supabase/types.ts is
// stale relative to the applied migrations, so checking a query against it
// produces both false positives and false negatives — four flagged "certain"
// column mismatches turned out to be two real, one already fixed, one wholly
// imaginary. This file only says *what the code asks for*; replay-queries.mjs
// says whether the database answers.

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('src');

/** Every .ts/.tsx under src/, excluding tests. */
function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Read a balanced-parenthesis argument list starting at the '(' index.
 * Handles nested parens and the three quote styles, so template-literal
 * selects like `*, instructor:profiles(id, first_name)` survive intact.
 */
function readArgs(text, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return { args: text.slice(openIdx + 1, i), end: i };
    }
  }
  return { args: '', end: openIdx };
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

/** First string literal in an argument list, or null when it's a variable. */
function firstLiteral(args) {
  const m = args.match(/^\s*(['"`])([^'"`]*)\1/);
  return m ? m[2] : null;
}

/**
 * Text from `.from(...)` to the end of that statement.
 *
 * Bounding this matters: an unbounded window walked past the semicolon and
 * attributed the NEXT query's `.select()` to this one, which invented
 * "notifications.due_date" and "blog_post_tags.first_name" — columns no code
 * ever asked for. Stop at the first `;` that is not inside parens or a string.
 */
function statementAfter(text, fromEnd) {
  let depth = 0;
  let quote = null;
  for (let i = fromEnd; i < text.length && i < fromEnd + 2000; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ';' && depth <= 0) return text.slice(fromEnd, i);
  }
  return text.slice(fromEnd, fromEnd + 2000);
}

/** The chained .select(...) belonging to this .from(table) call, if any. */
function selectAfter(stmt) {
  const m = stmt.match(/\.\s*select\s*\(/);
  if (!m) return null;
  const { args } = readArgs(stmt, m.index + m[0].length - 1);
  return firstLiteral(args);
}

function verbsAfter(stmt) {
  return ['insert', 'update', 'upsert', 'delete']
    .filter((v) => new RegExp(`\\.\\s*${v}\\s*\\(`).test(stmt));
}

/**
 * Keys of the params object literal in `.rpc('name', { … })`, top level only.
 *
 * Depth matters: a flat regex also matched keys nested inside a `p_metadata`
 * payload, so `log_security_event` looked like it was called with
 * `course_id`/`access_type` and got reported as a signature mismatch it does
 * not have.
 */
function topLevelKeys(args) {
  const objStart = args.indexOf('{');
  if (objStart === -1) return [];
  const keys = [];
  let depth = 0;
  let quote = null;
  let atKeyPosition = false;
  for (let i = objStart; i < args.length; i++) {
    const c = args[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{' || c === '[') { depth++; if (depth === 1) atKeyPosition = true; continue; }
    if (c === '}' || c === ']') { depth--; if (depth === 0) break; continue; }
    if (c === ',' && depth === 1) { atKeyPosition = true; continue; }
    if (depth === 1 && atKeyPosition) {
      const m = args.slice(i).match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (m) { keys.push(m[1]); i += m[0].length - 1; atKeyPosition = false; }
      else if (!/\s/.test(c)) atKeyPosition = false;
    }
  }
  return keys;
}

const records = [];

for (const file of sourceFiles(SRC)) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(process.cwd(), file);

  for (const m of text.matchAll(/\.\s*from\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const { args, end } = readArgs(text, open);
    const table = firstLiteral(args);
    if (!table) continue;                        // storage.from(variable) etc.
    // `supabase.storage.from(...)` and `supabase.from(...)` are the same method
    // name on different objects. Look back far enough to see the receiver —
    // a 20-char window missed `const { data } = await supabase.storage\n  .from(`.
    const before = text.slice(Math.max(0, m.index - 120), m.index);
    if (/storage\s*(\.\s*from)?\s*$/.test(before) || /\.\s*storage\b[\s\S]{0,60}$/.test(before)) {
      records.push({ kind: 'storage', bucket: table, file: rel, line: lineOf(text, m.index) });
      continue;
    }
    const stmt = statementAfter(text, end);
    records.push({
      kind: 'table',
      table,
      select: selectAfter(stmt),
      writes: verbsAfter(stmt),
      file: rel,
      line: lineOf(text, m.index),
    });
  }

  for (const m of text.matchAll(/\.\s*rpc\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const { args } = readArgs(text, open);
    const name = firstLiteral(args);
    if (!name) continue;
    records.push({ kind: 'rpc', name, args: topLevelKeys(args), file: rel, line: lineOf(text, m.index) });
  }

  for (const m of text.matchAll(/functions\s*\.\s*invoke\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const { args } = readArgs(text, open);
    const name = firstLiteral(args);
    if (!name) continue;
    records.push({ kind: 'function', name, file: rel, line: lineOf(text, m.index) });
  }
}

const out = { generatedFrom: 'src/', total: records.length, records };
fs.mkdirSync('.e2e-audit', { recursive: true });
fs.writeFileSync('.e2e-audit/query-inventory.json', JSON.stringify(out, null, 2));

const by = (k) => records.filter((r) => r.kind === k);
console.log(`tables   : ${by('table').length} call sites over ${new Set(by('table').map((r) => r.table)).size} tables`);
console.log(`rpcs     : ${by('rpc').length} call sites over ${new Set(by('rpc').map((r) => r.name)).size} functions`);
console.log(`functions: ${by('function').length} call sites over ${new Set(by('function').map((r) => r.name)).size} edge functions`);
console.log(`storage  : ${by('storage').length} call sites over ${new Set(by('storage').map((r) => r.bucket)).size} buckets`);
console.log('→ .e2e-audit/query-inventory.json');
