#!/usr/bin/env node
// ABOUTME: REVIEW DIFF (unapplied). Early fail-closed runner preflight for the le-iso probe. Read-only; fixed codes only.
// ABOUTME: Workflow order: checkout, npm ci --ignore-scripts, policy and invoked-mode checks, THIS, browser install, pin, probe.
//
// It runs after `npm ci --ignore-scripts` and the workflow policy/mode checks (the policy checker refuses any repo script
// executed before it), and before the browser install and the image build. A pass here is METADATA ONLY. It never stands
// in for the in-container SANDBOX smoke result, which stays the verdict.
//
// Drift it detects, exactly: Node process arch; the Docker DAEMON's Os and Arch (from `docker version`, not Node);
// ImageOS (the image family label only); Docker client and server versions; runc version; kernel major.minor ONLY (7.0,
// so a patch or ABI bump inside 7.0 passes); daemon seccomp builtin and AppArmor present; the three userns sysctls;
// the package-lock entries for @playwright/test, playwright and playwright-core (lockfile METADATA only: the actually
// resolved chain, revision, version and binary sha256 are enforced after install by browser-pin.mjs); and the profile
// bytes. NOT detected: the runner ImageVersion, the AppArmor parser or policy version, the host AppArmor profile text,
// kernel patch level and config, containerd version, and anything a runner update changes outside these facts.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { SECCOMP_COMPACT_SHA256, SECCOMP_PROFILE_REL, SECCOMP_RAW_SHA256, goCompact } from './expect.mjs';
import { buildProfile } from './seccomp-profile.mjs';
import { hostDiag, makeExec } from './run-probe.mjs';

/** The exact environment the profile and the Chromium flag list were derived and reviewed against. */
export const PINS = Object.freeze({
  NODE_ARCH: 'x64', DAEMON_OS: 'linux', DAEMON_ARCH: 'amd64', IMAGE_OS: 'ubuntu24',
  DOCKER_CLIENT: '28.0.4', DOCKER_SERVER: '28.0.4', RUNC: '1.5.2', KERNEL: '7.0',
  DAEMON_SECCOMP: 'BUILTIN', DAEMON_APPARMOR: 'PRESENT',
  HOST_AA_RESTRICT_USERNS: 'ON', HOST_USERNS_CLONE: 'ON', HOST_MAX_USERNS: 'POSITIVE',
  // lockfile metadata only; the resolved install is enforced by browser-pin.mjs (revision 1217, Chrome for Testing 147.0.7727.15)
  LOCK_PLAYWRIGHT_TEST: '1.59.1', LOCK_PLAYWRIGHT: '1.59.1', LOCK_PLAYWRIGHT_CORE: '1.59.1',
});
export const CHECK_ORDER = Object.freeze([...Object.keys(PINS), 'PROFILE']);

/** Pure verdict over gathered facts: one fixed line per check, in order, then PRE_OK or PRE_FAIL. Unknown is a failure. */
export function evaluate(facts) {
  const lines = [];
  let ok = true;
  for (const k of CHECK_ORDER) {
    const pass = k === 'PROFILE' ? facts.PROFILE === true : typeof facts[k] === 'string' && facts[k] === PINS[k];
    if (!pass) ok = false;
    lines.push(pass ? `PRE_${k} OK` : `PRE_E_${k}`);
  }
  lines.push(ok ? 'PRE_OK' : 'PRE_FAIL');
  return { ok, lines };
}

/** Profile drift: the committed file is the reviewed bytes, its Go-compacted form is the reviewed bytes, and the strict
 * builder reproduces it from the pinned upstream file and the delta. Any read or parse error is false. */
export function profileOk(fsx, repo) {
  try {
    const dir = path.join(repo, path.dirname(SECCOMP_PROFILE_REL));
    const raw = fsx.readFileSync(path.join(repo, SECCOMP_PROFILE_REL));
    const h = (b) => crypto.createHash('sha256').update(b).digest('hex');
    if (h(raw) !== SECCOMP_RAW_SHA256) return false;
    const c = goCompact(raw.toString('utf8'));
    if (c === null || h(Buffer.from(c, 'utf8')) !== SECCOMP_COMPACT_SHA256) return false;
    const built = buildProfile(fsx.readFileSync(path.join(dir, 'moby-28.0.4-default.json')), fsx.readFileSync(path.join(dir, 'chromium147-delta.json')));
    return built === raw.toString('utf8');
  } catch { return false; }
}

/** Gather facts read-only. Every failure leaves the fact unknown (which evaluate() fails). */
export async function gather({ exec, fsx, env, arch, repo }) {
  const f = { NODE_ARCH: arch, IMAGE_OS: typeof env.ImageOS === 'string' ? env.ImageOS : undefined };
  const hd = await hostDiag({}, exec, fsx, '/nonexistent/le-iso-preflight').catch(() => ({}));
  for (const k of ['DOCKER_CLIENT', 'DOCKER_SERVER', 'RUNC', 'KERNEL', 'DAEMON_SECCOMP', 'DAEMON_APPARMOR', 'HOST_AA_RESTRICT_USERNS', 'HOST_USERNS_CLONE', 'HOST_MAX_USERNS']) f[k] = hd[k];
  // The daemon's own platform (the seccomp profile's includes.arches is matched to the daemon's GOARCH, not Node's).
  try {
    const o = await exec('docker', ['version', '--format', '{{json .Server}}'], { timeout: 30000 });
    const sv = o?.ok === true && typeof o.stdout === 'string' ? JSON.parse(o.stdout) : null;
    f.DAEMON_OS = typeof sv?.Os === 'string' ? sv.Os : undefined;
    f.DAEMON_ARCH = typeof sv?.Arch === 'string' ? sv.Arch : undefined;
  } catch { f.DAEMON_OS = undefined; f.DAEMON_ARCH = undefined; }
  const lockKeys = { LOCK_PLAYWRIGHT_TEST: '@playwright/test', LOCK_PLAYWRIGHT: 'playwright', LOCK_PLAYWRIGHT_CORE: 'playwright-core' };
  const lock = (() => { try { return JSON.parse(fsx.readFileSync(path.join(repo, 'package-lock.json'), 'utf8')); } catch { return null; } })();
  for (const [k, name] of Object.entries(lockKeys)) {
    const v = lock?.packages?.[`node_modules/${name}`]?.version;
    f[k] = typeof v === 'string' ? v : undefined;
  }
  f.PROFILE = profileOk(fsx, repo);
  return f;
}

if (process.argv[1] && /preflight\.mjs$/.test(process.argv[1])) {
  const [repo] = process.argv.slice(2);
  const exec = makeExec(spawn);
  const facts = await gather({ exec, fsx: fs, env: process.env, arch: process.arch, repo: path.resolve(repo ?? '.') });
  const { ok, lines } = evaluate(facts);
  for (const l of lines) console.log(l);
  process.exit(ok ? 0 : 1);
}
