#!/usr/bin/env node
// ABOUTME: Classifies a migration file's TOP-LEVEL transaction control (comments, quoted strings, quoted identifiers and
// ABOUTME: dollar-quoted bodies are skipped), so the atomic apply can refuse any file whose own COMMIT could split it.
// Allowed shapes: NONE (no top-level transaction control), or WRAPPED (first statement BEGIN / START TRANSACTION, last
// statement COMMIT / END, nothing else). Anything else (inner COMMIT mid-file, ROLLBACK, SAVEPOINT, PREPARE TRANSACTION,
// a statement after the final COMMIT) is refused with exit 20. ANY psql metacommand (a backslash outside comments, quoted
// strings, quoted identifiers and dollar-quoted bodies: \gexec, \include, \set ON_ERROR_STOP off, \connect, \! ...) is
// refused with exit 23, because psql would execute it and it can run COMMIT or change error handling behind this check.
// Prints only the shape and a statement count; never SQL text.
import fs from 'node:fs';

export function topLevelStatements(sql) {
  const out = []; let cur = ''; let i = 0; let meta = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i], d = sql[i + 1];
    if (c === '-' && d === '-') { const j = sql.indexOf('\n', i); i = j < 0 ? n : j + 1; cur += ' '; continue; }
    if (c === '/' && d === '*') { let depth = 1; i += 2; while (i < n && depth) { if (sql[i] === '/' && sql[i + 1] === '*') { depth++; i += 2; } else if (sql[i] === '*' && sql[i + 1] === '/') { depth--; i += 2; } else i++; } cur += ' '; continue; }
    if (c === "'" || c === '"') { let j = i + 1; while (j < n) { if (sql[j] === c) { if (sql[j + 1] === c) { j += 2; continue; } break; } if (c === "'" && sql[j] === '\\' && /[eE]$/.test(sql.slice(Math.max(0, i - 1), i))) { j += 2; continue; } j++; } cur += c === '"' ? 'X' : "''"; i = j + 1; continue; }
    if (c === '$') { const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i)); if (m) { const end = sql.indexOf(m[0], i + m[0].length); if (end < 0) throw Object.assign(new Error('unterminated dollar quote'), { code: 21 }); cur += ' $body$ '; i = end + m[0].length; continue; } }
    if (c === '\\') { meta++; i++; continue; }
    if (c === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  if (meta) throw Object.assign(new Error('psql metacommand'), { code: 23 });
  return out;
}

const TXN = /^(begin|start\s+transaction|commit|end|rollback|abort|savepoint|release|prepare\s+transaction|commit\s+prepared|rollback\s+prepared)\b/i;
export function classify(sql) {
  const st = topLevelStatements(sql);
  const idx = st.map((s, k) => (TXN.test(s) ? k : -1)).filter((k) => k >= 0);
  if (idx.length === 0) return { shape: 'NONE', statements: st.length };
  const first = st[0], last = st[st.length - 1];
  if (idx.length === 2 && idx[0] === 0 && idx[1] === st.length - 1 && /^(begin|start\s+transaction)\b/i.test(first) && /^(commit|end)\b/i.test(last)
      && !/\b(isolation|read\s+only|deferrable)\b/i.test(first)) {
    return { shape: 'WRAPPED', statements: st.length };
  }
  return { shape: 'UNSUPPORTED', statements: st.length };
}

if (process.argv[1] && process.argv[1].endsWith('txn-control.mjs')) {
  try {
    const r = classify(fs.readFileSync(process.argv[2], 'utf8'));
    console.log(`TXN-CONTROL ${r.shape} statements=${r.statements}`);
    process.exit(r.shape === 'UNSUPPORTED' ? 20 : 0);
  } catch (e) { const msg = e.code === 23 ? 'psql metacommand outside quoted text' : e.code === 21 ? 'unterminated dollar quote' : 'file not classifiable'; console.error(`TXN-CONTROL REFUSED [${e.code ?? 22}]: ${msg}`); process.exit(e.code ?? 22); }
}
