#!/usr/bin/env node
// ABOUTME: Builds the sealed video lane's served copy with the SYNTHETIC API origin (DESIGN r2 section 4) and verifies the emitted
// ABOUTME: bundle: the exact origin present, no Supabase/production/local-API host, no source map. Fixed codes only.
//
//   video-build.mjs build <repo> <out dir (absent)>     build under an exact env (env -i equivalent), then scan
//   video-build.mjs scan  <out dir>                     scan only
//
// SOURCE CANDIDATE (sealed-video r1). UNRUN.
// The build child gets EXACTLY: PATH, HOME, NODE_ENV=production, VITE_SUPABASE_URL=https://sealed-video.invalid and a synthetic
// VITE_SUPABASE_ANON_KEY literal. Nothing is inherited, so no VITE_* or secret of the job can reach the bundle. Vite gives
// explicit env precedence over .env files; the build ALSO refuses when .env.local, .env.production or .env.production.local
// exists in the repo. Source maps are switched off on the command line, and any .map file in the output refuses: a map would
// carry src/config/security.ts's production fallback literal verbatim.
// The scanner is the effective control: the fallback literal in src/config/security.ts must have been constant-folded away.
// Writers (disclosed): the build output dir (created by vite, under the runner temp). Nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { VIDEO_API_ORIGIN } from './kinds.mjs';

export const SYNTHETIC_ANON_KEY = 'sealed-video-synthetic-publishable-key';
export const REFUSED_ENV_FILES = Object.freeze(['.env.local', '.env.production', '.env.production.local']);
/** Strings that must not appear in any emitted file. The last two are fixed fragments of security.ts's production fallbacks. */
export const FORBIDDEN = Object.freeze(['.supabase.co', '.supabase.in', '127.0.0.1:54321', 'localhost:54321', 'siuqvhscuiycvdrtiqsh',
  'InNpdXF2aHNjdWl5Y3ZkcnRpcXNo']);
export const SCAN_MAX_FILES = 2000;
export const SCAN_MAX_BYTES = 64 * 1024 * 1024;

/** The exact build environment. */
export function buildEnv({ PATH, HOME }) {
  if (typeof PATH !== 'string' || PATH === '' || typeof HOME !== 'string' || !path.isAbsolute(HOME)) throw new Error('buildEnv');
  return { PATH, HOME, NODE_ENV: 'production', VITE_SUPABASE_URL: VIDEO_API_ORIGIN, VITE_SUPABASE_ANON_KEY: SYNTHETIC_ANON_KEY };
}

/** The exact vite argv (run with LANE-independent host node, cwd = repo). */
export const buildArgs = (repo, outDir) => [path.join(repo, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'production', '--outDir', outDir, '--emptyOutDir', '--sourcemap', 'false'];

/**
 * Scan the emitted files. `files` is [{ rel, text }] (text decoded latin1, so every byte is visible). Returns a fixed code:
 * VIDEO_BUNDLE_OK, or the first failure among: no files / too many / too large, a .map file, a forbidden string in any file,
 * any mention of the synthetic host that is not the exact quoted origin, or no exact origin literal in any JS file. It never prints content.
 */
export function scanBundle(files) {
  if (!Array.isArray(files) || files.length === 0) return 'VIDEO_BUNDLE_E_EMPTY';
  if (files.length > SCAN_MAX_FILES) return 'VIDEO_BUNDLE_E_TOO_MANY';
  let total = 0;
  for (const f of files) total += typeof f?.text === 'string' ? f.text.length : SCAN_MAX_BYTES + 1;
  if (total > SCAN_MAX_BYTES) return 'VIDEO_BUNDLE_E_TOO_LARGE';
  if (!files.some((f) => f.rel === 'index.html')) return 'VIDEO_BUNDLE_E_NO_INDEX';
  if (files.some((f) => /\.map$/i.test(f.rel))) return 'VIDEO_BUNDLE_E_SOURCEMAP';
  for (const f of files) for (const s of FORBIDDEN) if (f.text.includes(s)) return 'VIDEO_BUNDLE_E_FORBIDDEN';
  // Exact origin, not a substring (correction c1): every mention of the synthetic host in any file must be the whole origin as a
  // quoted string literal, optionally followed by a path. A longer host (.invalid.evil), a port (:8443), userinfo either side
  // (...invalid@other, user@sealed-video...) or another scheme makes the bundle fail. At least one exact literal must be in JS.
  let exact = false;
  for (const f of files) {
    const v = originUses(f.text);
    if (v.bad) return 'VIDEO_BUNDLE_E_ORIGIN';
    if (v.exact && /\.m?js$/i.test(f.rel)) exact = true;
  }
  if (!exact) return 'VIDEO_BUNDLE_E_ORIGIN';
  return 'VIDEO_BUNDLE_OK';
}

export const ORIGIN_HOST = new URL(VIDEO_API_ORIGIN).host;
const QUOTES = new Set(['"', "'", '`']);
/**
 * Classify every occurrence of ORIGIN_HOST in `text`. An occurrence is EXACT only when it is preceded by exactly
 * `<quote>https://` and followed by the same quote or by `/`. Anything else (any other preceding or following character, such
 * as `.`, `:`, `@`, `-` or an alphanumeric) is BAD. Returns { exact, bad }.
 */
export function originUses(text) {
  let exact = false;
  const pre = 'https://';
  for (let i = text.indexOf(ORIGIN_HOST); i !== -1; i = text.indexOf(ORIGIN_HOST, i + 1)) {
    const start = i - pre.length;
    const q = start > 0 ? text[start - 1] : '';
    const after = text[i + ORIGIN_HOST.length] ?? '';
    const ok = start > 0 && text.slice(start, i) === pre && QUOTES.has(q) && (after === q || after === '/');
    if (!ok) return { exact, bad: true };
    exact = true;
  }
  return { exact, bad: false };
}

/** Read every regular file under `dir` (no symlinks followed; a symlink or other type refuses). */
export function readTree(fsx, dir) {
  const out = [];
  const walk = (d, rel) => {
    for (const e of fsx.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name), r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) { out.push({ rel: r, text: fsx.readFileSync(p).toString('latin1') }); if (out.length > SCAN_MAX_FILES) throw new Error('too many'); }
      else throw new Error('type');
    }
  };
  walk(dir, '');
  return out;
}

/** Repo-level refusal of env files that could override the explicit env in a production build. */
export const envFilesPresent = (fsx, repo) => REFUSED_ENV_FILES.filter((f) => { try { fsx.lstatSync(path.join(repo, f)); return true; } catch { return false; } });

export async function buildVideo(d, { repo, outDir }) {
  if (!path.isAbsolute(repo ?? '') || !path.isAbsolute(outDir ?? '') || outDir.startsWith(`${repo}/`) || outDir === repo) return 'VIDEO_BUILD_E_INPUT';
  if (d.exists(outDir)) return 'VIDEO_BUILD_E_INPUT';
  if (envFilesPresent(d.fs, repo).length) return 'VIDEO_BUILD_E_ENV_FILE';
  let env;
  try { env = buildEnv({ PATH: d.env.PATH, HOME: d.env.HOME }); } catch { return 'VIDEO_BUILD_E_INPUT'; }
  const r = await d.run(d.node, buildArgs(repo, outDir), { env, cwd: repo });
  if (r.code !== 0) return 'VIDEO_BUILD_E_BUILD';
  let files;
  try { files = readTree(d.fs, outDir); } catch { return 'VIDEO_BUNDLE_E_READ'; }
  return scanBundle(files);
}

if (process.argv[1] && /le-lane\/video-build\.mjs$/.test(process.argv[1])) {
  process.umask(0o077);
  const [cmd, a, b, ...rest] = process.argv.slice(2);
  const done = (code) => { console.log(code); process.exit(code === 'VIDEO_BUNDLE_OK' ? 0 : 1); };
  const run = (bin, args, o) => new Promise((resolve) => {
    let child;
    try { child = spawn(bin, args, { ...o, stdio: ['ignore', 'ignore', 'ignore'] }); } catch { resolve({ code: null }); return; }
    child.on('error', () => resolve({ code: null }));
    child.on('close', (code) => resolve({ code }));
  });
  const d = { fs, env: process.env, node: process.execPath, run, exists: (p) => { try { fs.lstatSync(p); return true; } catch { return false; } } };
  if (rest.length) done('VIDEO_BUILD_E_USAGE');
  else if (cmd === 'build') buildVideo(d, { repo: a, outDir: b }).then(done, () => done('VIDEO_BUILD_E_UNCLASSIFIED'));
  else if (cmd === 'scan' && b === undefined) { try { done(scanBundle(readTree(fs, a))); } catch { done('VIDEO_BUNDLE_E_READ'); } }
  else done('VIDEO_BUILD_E_USAGE');
}
