#!/usr/bin/env node
// ABOUTME: Host orchestrator for the synthetic lane-isolation feasibility probe: builds a FROM-scratch image from host files
// ABOUTME: (no pull), runs the sealed container once against a dummy nonce endpoint, verifies every teardown gate, cleans up.
//
// Usage: run-probe.mjs <repo abs path> <node abs path> <headless shell abs path>     (RUNNER_TEMP must be set)
// Prints ONLY fixed codes (HOST_CODES, and `LE-ISO <TEST> <CODE>` lines that passed classifyInner). Exit 0 only when every
// gate passed and the inner probe passed. No retry anywhere. No stack, credential, fixture, E1, pairing or migration.
// Host-owned paths: $RUNNER_TEMP/le-iso-host (control: image id, cid, endpoint records, build context; NEVER mounted),
// $RUNNER_TEMP/le-iso-sock (bound read-only), $RUNNER_TEMP/le-iso-out (bound read-write; probe scratch only). All three are
// created fresh (an existing one is refused) and removed at the end.
// Writers (disclosed): build context copies (copyFileSync), Dockerfile, passwd, group, manifest; mkdir of the three dirs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { CID, IMAGE_ID, IN, INNER_ORDER, absenceVerdict, classifyInner, compareInspect, exitStateOk, expectedConfig, parseLdd } from './expect.mjs';

/** Default dependencies; tests inject fakes. exec never throws and never exposes stderr. */
export const realDeps = {
  exec(bin, args, { timeout = 120000, max = 1 << 20 } = {}) {
    try { return { ok: true, stdout: execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout, maxBuffer: max }) }; }
    catch (e) { return { ok: false, stdout: '', status: typeof e?.status === 'number' ? e.status : null }; }
  },
  fs,
  spawnEndpoint(script, sockDir, ctlDir) { return spawn(process.execPath, [script, sockDir, ctlDir], { stdio: 'ignore' }); },
  sleep(ms) { return new Promise((r) => setTimeout(r, ms)); },
  uid: () => process.getuid(), gid: () => process.getgid(),
};

const NSS_DLOPEN = ['libsoftokn3.so', 'libfreeblpriv3.so', 'libnssckbi.so', 'libnssdbm3.so'];
const sha = (fsx, p) => crypto.createHash('sha256').update(fsx.readFileSync(p)).digest('hex');
const starttimeOf = (fsx, pid) => { const s = fsx.readFileSync(`/proc/${pid}/stat`, 'utf8'); return s.slice(s.lastIndexOf(')') + 2).split(' ')[19]; };

/** Build the image from host files only. Returns the image id or a HOST code string starting with ISO_E_. */
export function buildImage(d, { ctl, node, shell }) {
  const fsx = d.fs;
  const ctx = path.join(ctl, 'ctx');
  const root = path.join(ctx, 'rootfs');
  const files = new Set([node]);
  for (const bin of [node, shell]) {
    const r = d.exec('ldd', [bin], { timeout: 30000 });
    const libs = r.ok ? parseLdd(r.stdout) : null;
    if (!libs) return 'ISO_E_IMAGE_CLOSURE';
    for (const l of libs) files.add(l);
    for (const l of libs) if (path.basename(l).startsWith('libnss3.so')) for (const m of NSS_DLOPEN) { const p = path.join(path.dirname(l), m); if (fsx.existsSync(p)) files.add(p); }
  }
  const shellDir = path.dirname(shell);
  for (const e of fsx.readdirSync(shellDir, { withFileTypes: true })) if (e.isFile()) files.add(path.join(shellDir, e.name));
  const manifest = [];
  try {
    fsx.mkdirSync(root, { recursive: true, mode: 0o700 });
    for (const f of [...files].sort()) {
      const src = fsx.realpathSync(f);
      const dst = path.join(root, f);
      fsx.mkdirSync(path.dirname(dst), { recursive: true, mode: 0o755 });
      fsx.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL);
      fsx.chmodSync(dst, fsx.statSync(src).mode & 0o755);
      const h = sha(fsx, src);
      if (sha(fsx, dst) !== h) return 'ISO_E_IMAGE_MANIFEST';
      manifest.push(`${h}  ${f}`);
    }
    const uid = d.uid(), gid = d.gid();
    fsx.mkdirSync(path.join(root, 'etc'), { recursive: true, mode: 0o755 });
    fsx.writeFileSync(path.join(root, 'etc/passwd'), `probe:x:${uid}:${gid}::/tmp:/nonexistent\n`, { flag: 'wx', mode: 0o644 });
    fsx.writeFileSync(path.join(root, 'etc/group'), `probe:x:${gid}:\n`, { flag: 'wx', mode: 0o644 });
    for (const dir of ['tmp', 'iso/sock', 'iso/out']) fsx.mkdirSync(path.join(root, dir), { recursive: true, mode: 0o755 });
    fsx.writeFileSync(path.join(ctl, 'manifest.sha256'), `${manifest.join('\n')}\n`, { flag: 'wx', mode: 0o600 });
    fsx.writeFileSync(path.join(ctx, 'Dockerfile'), `FROM scratch\nCOPY rootfs/ /\nUSER ${uid}:${gid}\n`, { flag: 'wx', mode: 0o600 });
  } catch { return 'ISO_E_IMAGE_BUILD'; }
  const iid = path.join(ctl, 'image.id');
  const b = d.exec('docker', ['build', '--pull=false', '--network', 'none', '--no-cache', '--iidfile', iid, '-q', ctx], { timeout: 600000 });
  if (!b.ok) return 'ISO_E_IMAGE_BUILD';
  let id;
  try { id = fsx.readFileSync(iid, 'utf8').trim(); } catch { return 'ISO_E_IMAGE_BUILD'; }
  if (!IMAGE_ID.test(id)) return 'ISO_E_IMAGE_BUILD';
  const i = d.exec('docker', ['image', 'inspect', id]);
  let img;
  try { img = JSON.parse(i.stdout)[0]; } catch { img = null; }
  if (!i.ok || !img || img.Id !== id || (img.Config?.Volumes && Object.keys(img.Config.Volumes).length) || img.Config?.User !== `${uid}:${gid}`
    || (img.RootFS?.Layers ?? []).length !== 1 || img.Os !== 'linux') return { code: 'ISO_E_IMAGE_CONFIG', id };
  return { code: 'ISO_IMAGE_OK', id };
}

/** The docker create argv for one sealed container. */
export function createArgs({ cidfile, imageId, uid, gid, repo, sock, out, node, shell }) {
  return ['create', '--cidfile', cidfile,
    '--user', `${uid}:${gid}`, '--network', 'none', '--ipc', 'private', '--cgroupns', 'private',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only',
    '--tmpfs', '/tmp:rw,nosuid,nodev,size=64m', '--restart', 'no', '--log-driver', 'none', '--init',
    '-v', `${repo}:${repo}:ro,rprivate`, '-v', `${sock}:${IN.sock}:ro,rprivate`, '-v', `${out}:${IN.out}:rw,rprivate`,
    '-e', 'HOME=/tmp', '-e', 'TMPDIR=/tmp',
    imageId, node, path.join(repo, 'scripts/e2e/le-iso/inner-probe.mjs'), repo, shell];
}

export async function runProbe(d, { repo, node, shell, temp }) {
  const say = [];
  const out = (c) => say.push(c);
  const fsx = d.fs;
  const H = path.join(temp, 'le-iso-host'), S = path.join(temp, 'le-iso-sock'), O = path.join(temp, 'le-iso-out');
  let ok = true, imageId = null, cid = null, child = null, endpoint = null, innerPass = false;
  const fail = (c) => { ok = false; out(c); };

  // Inputs: absolute existing paths, fresh dirs (an existing dir is never reused).
  try {
    for (const p of [repo, node, shell, temp]) if (!path.isAbsolute(p ?? '') || !fsx.existsSync(p)) throw new Error('input');
    for (const p of [H, S, O]) if (fsx.existsSync(p)) throw new Error('exists');
    for (const p of [H, S, O]) fsx.mkdirSync(p, { mode: 0o700 });
    out('ISO_INPUT_OK');
  } catch { fail('ISO_E_INPUT'); return { ok, say }; }

  try {
    const b = (d.buildImage ?? buildImage)(d, { ctl: H, node, shell });
    if (typeof b === 'string') { fail(b); } else { imageId = b.id; if (b.code === 'ISO_IMAGE_OK') out(b.code); else fail(b.code); }

    if (ok) {
      child = d.spawnEndpoint(path.join(repo, 'scripts/e2e/le-iso/host-endpoint.mjs'), S, H);
      let rec = null;
      for (let i = 0; i < 50 && !rec; i++) { try { rec = fsx.readFileSync(path.join(H, 'ready'), 'utf8'); } catch { await d.sleep(200); } }
      const m = rec?.match(/^(\d+) (\d+) (\d+)\n$/);
      if (!m) fail('ISO_E_ENDPOINT_START');
      else {
        endpoint = { pid: Number(m[1]), start: m[2] };
        let st = null;
        try { st = starttimeOf(fsx, endpoint.pid); } catch { st = null; }
        if (endpoint.pid !== child.pid || st !== endpoint.start) fail('ISO_E_ENDPOINT_IDENTITY'); else out('ISO_ENDPOINT_OK');
      }
    }

    if (ok) {
      const cidfile = path.join(H, 'lane.cid');
      const c = d.exec('docker', createArgs({ cidfile, imageId, uid: d.uid(), gid: d.gid(), repo, sock: S, out: O, node, shell }));
      let read = null;
      try { read = fsx.readFileSync(cidfile, 'utf8').trim(); } catch { read = null; }
      if (read && CID.test(read)) cid = read;
      if (!c.ok) fail('ISO_E_CREATE');
      else if (!cid || c.stdout.trim() !== cid) fail('ISO_E_CID');
      else out('ISO_CREATE_OK');
    }

    if (ok) {
      const i = d.exec('docker', ['container', 'inspect', cid]);
      let obj = null;
      try { obj = JSON.parse(i.stdout)[0]; } catch { obj = null; }
      const bad = i.ok && obj && obj.Id === cid ? compareInspect(obj, expectedConfig({ imageId, uid: d.uid(), gid: d.gid(), repo, sock: S, out: O })) : ['INSPECT'];
      if (bad.length) fail('ISO_E_CONFIG'); else out('ISO_CONFIG_OK');
    }

    if (ok) {
      const r = d.exec('docker', ['start', '-a', cid], { timeout: 300000, max: 1 << 16 });
      const cls = classifyInner(r.stdout);
      if (!cls.ok && !r.ok) fail('ISO_E_START');
      else if (!cls.ok) { out('ISO_RUN_DONE'); fail('ISO_E_INNER_OUTPUT'); }
      else { out('ISO_RUN_DONE'); for (const t of INNER_ORDER) out(`LE-ISO ${t} ${cls.results[t]}`); innerPass = cls.pass && r.ok; }
    }
  } finally {
    // Teardown, always, each gate with its own code; no retry.
    if (cid) {
      const w = d.exec('docker', ['wait', cid], { timeout: 60000 });
      const i = d.exec('docker', ['container', 'inspect', cid]);
      let obj = null;
      try { obj = JSON.parse(i.stdout)[0]; } catch { obj = null; }
      if (!w.ok) fail('ISO_E_WAIT');
      else if (!i.ok || !obj || obj.Id !== cid || !exitStateOk(obj)) fail('ISO_E_EXIT_STATE');
      else out('ISO_EXIT_OK');
      const rm = d.exec('docker', ['rm', cid]);
      if (!rm.ok || rm.stdout.trim() !== cid) fail('ISO_E_RM'); else out('ISO_RM_OK');
      const ls = d.exec('docker', ['container', 'ls', '-a', '--no-trunc', '--filter', `id=${cid}`, '--format', '{{.ID}}']);
      const v = absenceVerdict(ls.ok, ls.stdout, cid);
      if (v === 'absent') out('ISO_ABSENT'); else fail(v === 'present' ? 'ISO_E_STILL_PRESENT' : 'ISO_E_ABSENCE_UNDECIDED');
    }
    if (child) {
      let same = false;
      try { same = !!endpoint && starttimeOf(fsx, endpoint.pid) === endpoint.start && endpoint.pid === child.pid; } catch { same = false; }
      if (!same) fail('ISO_E_ENDPOINT_IDENTITY_CHANGED');
      else {
        const exited = new Promise((r) => { if (child.exitCode !== null) r(child.exitCode); else child.once('exit', (code) => r(code)); });
        child.kill('SIGTERM');
        const code = await Promise.race([exited, d.sleep(10000).then(() => 'timeout')]);
        let gone = false;
        try { fsx.statSync(`/proc/${endpoint.pid}`); gone = false; } catch (e) { gone = e?.code === 'ENOENT'; }
        if (code !== 0 || !gone) fail('ISO_E_ENDPOINT_TERMINATION');
        else {
          let fin = null;
          try { fin = fsx.readFileSync(path.join(H, 'final'), 'utf8').match(/^(\d+) (\d+)\n$/); } catch { fin = null; }
          if (!fin || Number(fin[1]) < 1 || Number(fin[2]) !== 0) fail('ISO_E_ENDPOINT_CONNS'); else out('ISO_ENDPOINT_STOPPED');
        }
      }
    }
    if (imageId) {
      const r = d.exec('docker', ['image', 'rm', imageId]);
      if (!r.ok) fail('ISO_E_IMAGE_REMOVE');
      else {
        const ls = d.exec('docker', ['image', 'ls', '-a', '-q', '--no-trunc']);
        const ids = ls.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
        if (!ls.ok || ids.some((x) => !IMAGE_ID.test(x))) fail('ISO_E_IMAGE_ABSENCE');
        else if (ids.includes(imageId)) fail('ISO_E_IMAGE_ABSENCE');
        else out('ISO_IMAGE_REMOVED');
      }
    }
    try {
      for (const p of [H, S, O]) fsx.rmSync(p, { recursive: true, force: false });
      if ([H, S, O].some((p) => fsx.existsSync(p))) throw new Error('left');
      out('ISO_DIRS_REMOVED');
    } catch { fail('ISO_E_DIRS'); }
  }
  out(innerPass ? 'ISO_INNER_PASS' : 'ISO_INNER_FAIL');
  return { ok: ok && innerPass, say };
}

if (process.argv[1] && /run-probe\.mjs$/.test(process.argv[1])) {
  const [repo, node, shell] = process.argv.slice(2);
  runProbe(realDeps, { repo, node, shell, temp: process.env.RUNNER_TEMP })
    .then((r) => { for (const l of r.say) console.log(l); process.exit(r.ok ? 0 : 1); })
    .catch(() => { console.log('ISO_E_INPUT'); process.exit(1); });
}
