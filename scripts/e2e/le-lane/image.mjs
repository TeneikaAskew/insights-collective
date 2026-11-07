#!/usr/bin/env node
// ABOUTME: Builds the E1 lane image FROM scratch out of host files (no pull, no network) before any stack starts, and removes it
// ABOUTME: afterwards only when the host lane receipts establish that no lane container can still hold it. Fixed codes only.
//
//   image.mjs build   <ctl dir (absent)> <repo> <node abs path> <headless shell abs path>
//   image.mjs cleanup <ctl dir> <repo>
//
// Writers (disclosed, host-owned control dir only, never mounted): mkdir of <ctl> (0700) and the build context, copies of the
// closure files into ctx/rootfs (COPYFILE_EXCL; the job's Node to rootfs/usr/bin/node), ctx/rootfs/etc/passwd and group,
// ctx/Dockerfile, manifest.sha256, the build-invoked receipt, image-build.rec and image-cleanup.rec (all wx). docker writes the iidfile. Docker clients run with a sanitized environment (sanitizedEnv).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { makeExec } from '../le-iso/run-probe.mjs';
import { parseLdd, BROWSER_PATH_RE } from '../le-iso/expect.mjs';
import { FONT_DIRS, IMAGE_ID, IMAGE_PATH_ENV, IMAGE_WORKDIR, LANE_FONTS_CONF, LANE_FONTS_CONF_PATH, LANE_NODE, PSQL_REAL, TOOL_PATHS, imageBuildRecord, imageCleanupRecord, imageConfigProblems, imageFieldLines, lanePaths, laneVerdict,
  parseImageBuildRecord, parseImageCleanupRecord } from './contract.mjs';

const NSS_DLOPEN = ['libsoftokn3.so', 'libfreeblpriv3.so', 'libnssckbi.so', 'libnssdbm3.so'];

/** The only variables a docker client (or the bridge) inherits: no stack URL, key, password or token can reach them. */
export function sanitizedEnv(env) {
  const out = { PATH: '/usr/bin:/bin' };
  if (typeof env.HOME === 'string' && path.isAbsolute(env.HOME)) out.HOME = env.HOME;
  return out;
}
export const spawnClean = (bin, args, opts) => spawn(bin, args, { ...opts, env: sanitizedEnv(process.env) });

export const realDeps = {
  exec: makeExec(spawnClean),
  fs,
  files: { put: (p, data, mode) => fs.writeFileSync(p, data, { flag: 'wx', mode }) },
  uid: () => process.getuid(), gid: () => process.getgid(),
};

const sha = (fsx, p) => crypto.createHash('sha256').update(fsx.readFileSync(p)).digest('hex');

/**
 * Build. Returns { code, id, invoked, clientsReaped, record }. Once the control dir exists, the build ALWAYS ends by writing
 * C/image-build.rec (imageBuildRecord): whether `docker build` was invoked, the image id (NONE when never invoked, UNKNOWN when
 * invoked without a readable valid iidfile), whether EVERY client it ran (ldd, docker build, docker image inspect) was reaped,
 * and the result code. Later steps read that record; they never infer a clean state from a missing or unresolved one.
 * The job's Node (`node`, the toolcache path) is copied to LANE_NODE in the rootfs; its hash goes into the manifest.
 */
export async function buildLaneImage(d, { ctl, repo, node, shell }) {
  const fsx = d.fs;
  const L = lanePaths('/nonexistent-p', ctl, repo);
  if (!BROWSER_PATH_RE.test(shell ?? '') || !path.isAbsolute(node ?? '') || node === LANE_NODE) return { code: 'LANE_E_IMAGE_INPUT', id: null, invoked: false, clientsReaped: true, record: false };
  try { if (fsx.existsSync(ctl)) return { code: 'LANE_E_IMAGE_INPUT', id: null, invoked: false, clientsReaped: true, record: false }; fsx.mkdirSync(ctl, { mode: 0o700 }); }
  catch { return { code: 'LANE_E_IMAGE_INPUT', id: null, invoked: false, clientsReaped: true, record: false }; }
  let invoked = false, id = null, clientsReaped = true, code, bad = [], fieldLines = [];
  const x = async (...a) => { const r = await d.exec(...a); if (!r || r.unreaped) clientsReaped = false; return r ?? { ok: false, stdout: '' }; };
  try {
    code = await (async () => {
      // [destination in rootfs, host source]; node is the one entry whose destination differs from its source.
      const entries = new Map([[LANE_NODE, node], [PSQL_REAL, PSQL_REAL], ...TOOL_PATHS.map((t) => [t, t])]);
      for (const bin of [node, shell, PSQL_REAL, ...TOOL_PATHS]) {
        const r = await x('ldd', [bin], { timeout: 30000 });
        const libs = r.ok ? parseLdd(r.stdout) : null;
        if (!libs) return 'LANE_E_IMAGE_CLOSURE';
        for (const l of libs) if (!entries.has(l)) entries.set(l, l);
        for (const l of libs) if (path.basename(l).startsWith('libnss3.so')) for (const m of NSS_DLOPEN) { const p = path.join(path.dirname(l), m); if (fsx.existsSync(p) && !entries.has(p)) entries.set(p, p); }
      }
      const shellDir = path.dirname(shell);
      for (const e of fsx.readdirSync(shellDir, { withFileTypes: true })) if (e.isFile()) { const p = path.join(shellDir, e.name); if (!entries.has(p)) entries.set(p, p); }
      // Fonts (contract.mjs FONTS_SHIPPED): without any, the headless shell aborts on the first text layout.
      let fonts = 0;
      for (const dir of FONT_DIRS) {
        if (!fsx.existsSync(dir)) continue;
        for (const e of fsx.readdirSync(dir, { withFileTypes: true })) {
          if (!e.isFile() || !e.name.endsWith('.ttf')) continue;
          const p = path.join(dir, e.name);
          if (!entries.has(p)) { entries.set(p, p); fonts += 1; }
        }
      }
      if (fonts === 0) return 'LANE_E_IMAGE_FONTS';
      const root = path.join(L.ctx, 'rootfs');
      const manifest = [];
      const uid = d.uid(), gid = d.gid();
      try {
        fsx.mkdirSync(root, { recursive: true, mode: 0o700 });
        for (const dst of [...entries.keys()].sort()) {
          const src = fsx.realpathSync(entries.get(dst));
          const to = path.join(root, dst);
          fsx.mkdirSync(path.dirname(to), { recursive: true, mode: 0o755 });
          fsx.copyFileSync(src, to, fs.constants.COPYFILE_EXCL);
          fsx.chmodSync(to, fsx.statSync(src).mode & 0o755);
          const h = sha(fsx, src);
          if (sha(fsx, to) !== h) return 'LANE_E_IMAGE_MANIFEST';
          manifest.push(`${h}  ${dst}`);
        }
        fsx.mkdirSync(path.join(root, 'etc'), { recursive: true, mode: 0o755 });
        fsx.mkdirSync(path.join(root, 'tmp'), { recursive: true, mode: 0o755 });
        d.files.put(path.join(root, 'etc/passwd'), `lane:x:${uid}:${gid}::/tmp:/nonexistent\n`, 0o644);
        d.files.put(path.join(root, 'etc/group'), `lane:x:${gid}:\n`, 0o644);
        fsx.mkdirSync(path.join(root, path.dirname(LANE_FONTS_CONF_PATH)), { recursive: true, mode: 0o755 });
        d.files.put(path.join(root, LANE_FONTS_CONF_PATH), LANE_FONTS_CONF, 0o644);
        d.files.put(L.manifest, `${manifest.join('\n')}\n`, 0o600);
        d.files.put(path.join(L.ctx, 'Dockerfile'), `FROM scratch\nCOPY rootfs/ /\nENV ${IMAGE_PATH_ENV}\nWORKDIR ${IMAGE_WORKDIR}\nUSER ${uid}:${gid}\n`, 0o600);
        d.files.put(path.join(ctl, 'build-invoked'), 'build-invoked\n', 0o600);
      } catch { return 'LANE_E_IMAGE_BUILD'; }
      invoked = true;
      const b = await x('docker', ['build', '--pull=false', '--network', 'none', '--no-cache', '--iidfile', L.iid, '-q', L.ctx], { timeout: 600000 });
      try { const t = fsx.readFileSync(L.iid, 'utf8').trim(); id = IMAGE_ID.test(t) ? t : null; } catch { id = null; }
      if (!b.ok || !id) return 'LANE_E_IMAGE_BUILD';
      const i = await x('docker', ['image', 'inspect', id]);
      let img = null;
      try { img = JSON.parse(i.stdout)[0]; } catch { img = null; }
      bad = i.ok ? imageConfigProblems(img, { id, uid, gid }) : ['INSPECT'];
      fieldLines = imageFieldLines(i.ok ? img : null, bad);
      return bad.length ? 'LANE_E_IMAGE_CONFIG' : 'LANE_IMAGE_OK';
    })();
  } catch { code = 'LANE_E_IMAGE_UNCLASSIFIED'; }
  let record = true;
  try { d.files.put(L.imageBuildRec, imageBuildRecord({ invoked, id, clientsReaped, result: code }), 0o600); } catch { record = false; }
  const ok = code === 'LANE_IMAGE_OK' && clientsReaped && record;
  return { code: ok ? code : code === 'LANE_IMAGE_OK' ? 'LANE_E_IMAGE_UNRESOLVED' : code, id, invoked, clientsReaped, record, bad, fieldLines };
}

/**
 * Cleanup (always). Reads C/image-build.rec first: missing/unparseable, unreaped build clients or an UNKNOWN id hold the image
 * as UNRESOLVED (a still-running build could yet create it). Removes the image ONLY when the lane receipts say no container can
 * hold it (never invoked, or proven absent). Ends by writing C/image-cleanup.rec (wx) with its own client state.
 */
export async function cleanupLaneImage(d, { ctl, repo }) {
  const fsx = d.fs;
  const L = lanePaths('/nonexistent-p', ctl, repo);
  let clientsReaped = true;
  const x = async (...a) => { const r = await d.exec(...a); if (!r || r.unreaped) clientsReaped = false; return r ?? { ok: false, stdout: '' }; };
  const exists = (p) => { try { fsx.lstatSync(p); return true; } catch (e) { return e?.code === 'ENOENT' ? false : null; } };
  const code = await (async () => {
    let rec = null;
    try { rec = parseImageBuildRecord(fsx.readFileSync(L.imageBuildRec, 'utf8')); } catch { rec = null; }
    const invokedReceipt = exists(path.join(ctl, 'build-invoked'));
    if (!rec || invokedReceipt === null || invokedReceipt !== rec.invoked) return 'LANE_E_IMAGE_RECORD';
    if (rec.clients !== 'REAPED') return 'LANE_E_IMAGE_BUILD_CLIENTS_UNRESOLVED';
    if (!rec.invoked) return 'LANE_IMAGE_NOT_BUILT';
    let file = null;
    try { file = fsx.readFileSync(L.iid, 'utf8').trim(); } catch { file = null; }
    if (rec.id === 'UNKNOWN' || file !== rec.id) return 'LANE_E_IMAGE_ID';
    const id = rec.id;
    const started = exists(L.started);
    let gatesText = null;
    try { gatesText = fsx.readFileSync(L.gates, 'utf8'); } catch { gatesText = null; }
    const v = started === null ? { ok: false } : laneVerdict({ runLaneStarted: started, gatesText });
    if (!v.ok || !['LANE_NO_CONTAINER', 'LANE_ABSENT'].includes(v.container)) return 'LANE_E_IMAGE_HELD_UNRESOLVED';
    const r = await x('docker', ['image', 'rm', id], { timeout: 60000 });
    if (!r.ok) return r.unreaped ? 'LANE_E_IMAGE_CLIENT_UNREAPED' : 'LANE_E_IMAGE_REMOVE';
    const ls = await x('docker', ['image', 'ls', '-a', '-q', '--no-trunc'], { timeout: 30000 });
    const ids = String(ls.stdout).split('\n').map((l) => l.trim()).filter(Boolean);
    if (!ls.ok || ids.some((y) => !IMAGE_ID.test(y))) return 'LANE_E_IMAGE_ABSENCE';
    if (ids.includes(id)) return 'LANE_E_IMAGE_STILL_PRESENT';
    return 'LANE_IMAGE_REMOVED';
  })().catch(() => 'LANE_E_IMAGE_RECORD');
  const text = imageCleanupRecord({ code, clientsReaped });
  let written = true;
  try { d.files.put(L.imageCleanupRec, text, 0o600); } catch { written = false; }
  const clean = parseImageCleanupRecord(text)?.result === 'CLEAN';
  const lines = [code, `LANE_IMAGE_CLIENTS ${clientsReaped ? 'REAPED' : 'UNRESOLVED'}`, written ? `LANE_IMAGE_CLEANUP ${clean ? 'CLEAN' : 'UNRESOLVED'}` : 'LANE_E_IMAGE_CLEANUP_RECORD'];
  return { ok: clean && written, lines };
}

if (process.argv[1] && /le-lane\/image\.mjs$/.test(process.argv[1])) {
  const [cmd, ctl, repo, node, shell] = process.argv.slice(2);
  const done = (ok, lines) => { for (const l of lines) console.log(l); process.exit(ok ? 0 : 1); };
  (async () => {
    if (cmd === 'build') {
      const r = await buildLaneImage(realDeps, { ctl, repo, node, shell });
      done(r.code === 'LANE_IMAGE_OK', [r.code, ...(Array.isArray(r.fieldLines) ? r.fieldLines : []),
        `LANE_IMAGE_CLIENTS ${r.clientsReaped ? 'REAPED' : 'UNRESOLVED'}`, r.record ? 'LANE_IMAGE_RECORD_OK' : 'LANE_E_IMAGE_RECORD']);
    } else if (cmd === 'cleanup') {
      const r = await cleanupLaneImage(realDeps, { ctl, repo });
      done(r.ok, r.lines);
    } else done(false, ['LANE_E_IMAGE_USAGE']);
  })().catch(() => done(false, ['LANE_E_IMAGE_UNCLASSIFIED']));
}
