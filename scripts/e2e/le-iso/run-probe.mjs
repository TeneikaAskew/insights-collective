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
import { spawn } from 'node:child_process';
import { CID, IMAGE_ID, IN, INNER_ORDER, LIMITS, absenceVerdict, configFieldLines, createdNeverStarted, classifyInner, compareInspect, exitStateOk, expectedConfig, parseLdd, SECCOMP_PROFILE_REL, SECCOMP_RAW_SHA256, BROWSER_PIN, BROWSER_PATH_RE, stopOutputCategory, tmpfsSpec, HOST_DIAG_ORDER, INNER_DIAG_ORDER, daemonSecurity, hostDiagLine, sysctlClass } from './expect.mjs';

/**
 * A genuinely bounded client exec. At `timeout` the client gets SIGTERM, after `grace` SIGKILL, and after another `grace`
 * the promise resolves even if the client was never reaped (unreaped: true). So the caller ALWAYS regains control within
 * timeout + 2 * grace, keeps whatever identity it holds (e.g. the CID) and does its own host-side stop/wait. Output over
 * `max` bytes is a failure (client killed). Never throws; stderr is never read.
 */
export function makeExec(spawnFn, { grace = 2000, clampMs = Infinity } = {}) { // clampMs: tests only, shortens every timeout
  return (bin, args, { timeout = 120000, max = 1 << 20 } = {}) => new Promise((resolve) => {
    let child, done = false, timedOut = false, over = false, size = 0;
    const chunks = [], timers = [];
    const finish = (r) => { if (!done) { done = true; for (const t of timers) clearTimeout(t); resolve(r); } };
    const kill = (sig) => { try { child.kill(sig); } catch { /* reaped already */ } };
    try { child = spawnFn(bin, args, { stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { finish({ ok: false, stdout: '', status: null }); return; }
    child.on('error', () => finish({ ok: false, stdout: '', status: null }));
    child.stdout?.on('data', (b) => { size += b.length; if (size > max) { over = true; kill('SIGKILL'); } else chunks.push(b); });
    child.on('close', (code) => finish({ ok: code === 0 && !timedOut && !over, stdout: timedOut || over ? '' : Buffer.concat(chunks).toString('utf8'), status: code, timedOut }));
    timers.push(setTimeout(() => {
      timedOut = true; kill('SIGTERM');
      timers.push(setTimeout(() => {
        kill('SIGKILL');
        timers.push(setTimeout(() => finish({ ok: false, stdout: '', status: null, timedOut: true, unreaped: true }), grace));
      }, grace));
    }, Math.min(timeout, clampMs)));
  });
}

/** Default dependencies; tests inject fakes. */
export const realDeps = {
  exec: makeExec(spawn),
  fs,
  spawnEndpoint(script, sockDir, ctlDir) { return spawn(process.execPath, [script, sockDir, ctlDir], { stdio: 'ignore' }); }, // caller attaches 'error' at once
  sleep(ms) { return new Promise((r) => setTimeout(r, ms)); },
  uid: () => process.getuid(), gid: () => process.getgid(),
};

const NSS_DLOPEN = ['libsoftokn3.so', 'libfreeblpriv3.so', 'libnssckbi.so', 'libnssdbm3.so'];
const sha = (fsx, p) => crypto.createHash('sha256').update(fsx.readFileSync(p)).digest('hex');
const starttimeOf = (fsx, pid) => { const s = fsx.readFileSync(`/proc/${pid}/stat`, 'utf8'); return s.slice(s.lastIndexOf(')') + 2).split(' ')[19]; };

/**
 * Build the image from host files only. Returns a plain ISO_E_ code string ONLY when docker build was never invoked (no
 * image can exist). Once build was invoked it returns { code, id }: id is the confirmed image id (from the iidfile, read
 * even when the build reports failure), or null when an image may exist but its identity is unknown. The caller must
 * treat id === null after an invoked build as UNRESOLVED and preserve the control dir.
 */
export async function buildImage(d, { ctl, node, shell }) {
  const fsx = d.fs;
  const ctx = path.join(ctl, 'ctx');
  const root = path.join(ctx, 'rootfs');
  const files = new Set([node]);
  for (const bin of [node, shell]) {
    const r = await d.exec('ldd', [bin], { timeout: 30000 });
    const libs = r.ok ? parseLdd(r.stdout) : null;
    if (!libs) return 'ISO_E_IMAGE_CLOSURE';
    for (const l of libs) files.add(l);
    for (const l of libs) if (path.basename(l).startsWith('libnss3.so')) for (const m of NSS_DLOPEN) { const p = path.join(path.dirname(l), m); if (fsx.existsSync(p)) files.add(p); }
  }
  const shellDir = path.dirname(shell);
  for (const e of fsx.readdirSync(shellDir, { withFileTypes: true })) if (e.isFile()) files.add(path.join(shellDir, e.name));
  const manifest = [];
  const uid = d.uid(), gid = d.gid();
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
    fsx.mkdirSync(path.join(root, 'etc'), { recursive: true, mode: 0o755 });
    fsx.writeFileSync(path.join(root, 'etc/passwd'), `probe:x:${uid}:${gid}::/tmp:/nonexistent\n`, { flag: 'wx', mode: 0o644 });
    fsx.writeFileSync(path.join(root, 'etc/group'), `probe:x:${gid}:\n`, { flag: 'wx', mode: 0o644 });
    for (const dir of ['tmp', 'iso/sock', 'iso/out']) fsx.mkdirSync(path.join(root, dir), { recursive: true, mode: 0o755 });
    fsx.writeFileSync(path.join(ctl, 'manifest.sha256'), `${manifest.join('\n')}\n`, { flag: 'wx', mode: 0o600 });
    fsx.writeFileSync(path.join(ctx, 'Dockerfile'), `FROM scratch\nCOPY rootfs/ /\nUSER ${uid}:${gid}\n`, { flag: 'wx', mode: 0o600 });
  } catch { return 'ISO_E_IMAGE_BUILD'; }
  const iid = path.join(ctl, 'image.id');
  const b = await d.exec('docker', ['build', '--pull=false', '--network', 'none', '--no-cache', '--iidfile', iid, '-q', ctx], { timeout: 600000 });
  let id = null;
  try { const t = fsx.readFileSync(iid, 'utf8').trim(); id = IMAGE_ID.test(t) ? t : null; } catch { id = null; }
  if (!b.ok || !id) return { code: 'ISO_E_IMAGE_BUILD', id };
  const i = await d.exec('docker', ['image', 'inspect', id]);
  let img;
  try { img = JSON.parse(i.stdout)[0]; } catch { img = null; }
  if (!i.ok || !img || img.Id !== id || (img.Config?.Volumes && Object.keys(img.Config.Volumes).length) || img.Config?.User !== `${uid}:${gid}`
    || (img.RootFS?.Layers ?? []).length !== 1 || img.Os !== 'linux') return { code: 'ISO_E_IMAGE_CONFIG', id };
  return { code: 'ISO_IMAGE_OK', id };
}

/** The docker create argv for one sealed container. */
export function createArgs({ cidfile, imageId, uid, gid, repo, sock, out, node, shell, seccompPath }) {
  return ['create', '--cidfile', cidfile,
    '--user', `${uid}:${gid}`, '--network', 'none', '--ipc', 'private', '--cgroupns', 'private',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--security-opt', `seccomp=${seccompPath}`, '--read-only',
    '--tmpfs', `/tmp:${tmpfsSpec(uid, gid)}`, '--restart', 'no', '--log-driver', 'none', '--init',
    '--cpus', String(LIMITS.NanoCpus / 1e9), '--memory', String(LIMITS.Memory), '--memory-swap', String(LIMITS.MemorySwap),
    '--pids-limit', String(LIMITS.PidsLimit), '--shm-size', String(LIMITS.ShmSize),
    '-v', `${repo}:${repo}:ro,rprivate`, '-v', `${sock}:${IN.sock}:ro,rprivate`, '-v', `${out}:${IN.out}:rw,rprivate`,
    '-e', 'HOME=/tmp', '-e', 'TMPDIR=/tmp',
    imageId, node, path.join(repo, 'scripts/e2e/le-iso/inner-probe.mjs'), repo, shell];
}

/**
 * r7/r8 host diagnostics (read-only): docker client/server and runc versions, the daemon's seccomp/AppArmor options, the
 * kernel release and the host's user-namespace switches, and whether a file named chrome-sandbox sits beside the shell.
 * Every value is reduced by hostDiagLine to a closed code or a plain version; nothing else is printed.
 * r8: never throws. Every key starts UNKNOWN; a rejected or failed query, a malformed value, or any unexpected error leaves
 * UNKNOWN. Queries still go through x(), so an unreaped client keeps marking the run UNRESOLVED (evidence preserved).
 */
export async function hostDiag(d, x, fsx, shell) {
  const r = Object.fromEntries(HOST_DIAG_ORDER.map((k) => [k, 'UNKNOWN']));
  const str = (v) => (typeof v === 'string' ? v : undefined);
  const q = async (args) => { try { const o = await x('docker', args, { timeout: 30000 }); return o?.ok === true && typeof o.stdout === 'string' ? o.stdout : null; } catch { return null; } };
  const json = (t) => { try { return t === null ? null : JSON.parse(t); } catch { return null; } };
  try {
    const vj = json(await q(['version', '--format', '{{json .}}']));
    r.DOCKER_CLIENT = str(vj?.Client?.Version) ?? 'UNKNOWN';
    r.DOCKER_SERVER = str(vj?.Server?.Version) ?? 'UNKNOWN';
    const comps = Array.isArray(vj?.Server?.Components) ? vj.Server.Components : [];
    const rv = str(comps.find((c) => c?.Name === 'runc')?.Version);
    r.RUNC = rv === undefined ? 'UNKNOWN' : rv.replace(/^v/, '');
    const sec = daemonSecurity(json(await q(['info', '--format', '{{json .SecurityOptions}}'])));
    r.DAEMON_SECCOMP = sec.seccomp; r.DAEMON_APPARMOR = sec.apparmor;
    const readText = (p) => { try { return fsx.readFileSync(p, 'utf8'); } catch (e) { return e?.code === 'ENOENT' ? 'ABSENT' : null; } };
    const rel = readText('/proc/sys/kernel/osrelease');
    r.KERNEL = (typeof rel === 'string' && rel !== 'ABSENT' ? (rel.match(/^(\d{1,4}\.\d{1,4})/) ?? [])[1] : undefined) ?? 'UNKNOWN';
    const sw = (p, kind) => { const t = readText(p); return t === 'ABSENT' ? 'ABSENT' : sysctlClass(t, kind); };
    r.HOST_MAX_USERNS = sw('/proc/sys/user/max_user_namespaces', 'count');
    r.HOST_AA_RESTRICT_USERNS = sw('/proc/sys/kernel/apparmor_restrict_unprivileged_userns', 'switch');
    r.HOST_USERNS_CLONE = sw('/proc/sys/kernel/unprivileged_userns_clone', 'switch');
    // Existence only, never usability (owner, setuid bit and mode are not read). Only ENOENT is ABSENT; EACCES and every
    // other error stay UNKNOWN. Chromium's helper name is chrome-sandbox (hyphen).
    try { fsx.statSync(path.join(path.dirname(shell), 'chrome-sandbox')); r.CHROME_SANDBOX_FILE = 'EXISTS'; }
    catch (e) { r.CHROME_SANDBOX_FILE = e?.code === 'ENOENT' ? 'ABSENT' : 'UNKNOWN'; }
  } catch { /* any key not yet set stays UNKNOWN */ }
  return r;
}

export async function runProbe(d, { repo, node, shell, temp }) {
  const say = [];
  const out = (c) => say.push(c);
  const fsx = d.fs;
  const H = path.join(temp, 'le-iso-host'), S = path.join(temp, 'le-iso-sock'), O = path.join(temp, 'le-iso-out');
  let ok = true, imageId = null, cid = null, child = null, endpoint = null, innerPass = false, createTried = false, buildInvoked = false, startInvoked = false, clientUnreaped = false;
  const fail = (c) => { ok = false; out(c); };
  // Every docker/ldd client call goes through x(): a client left unreaped after SIGKILL marks the run UNRESOLVED.
  const x = async (...a) => { const r = await d.exec(...a); if (r?.unreaped) clientUnreaped = true; return r; };

  // Inputs: absolute existing paths, fresh dirs (an existing dir is never reused). A partial setup removes ONLY the dirs
  // this run created (empty, non-recursive) and verifies they are gone; a pre-existing dir is never touched.
  const created = [];
  try {
    for (const p of [repo, node, shell, temp]) if (!path.isAbsolute(p ?? '') || !fsx.existsSync(p)) throw new Error('input');
    for (const p of [H, S, O]) if (fsx.existsSync(p)) throw new Error('exists');
    for (const p of [H, S, O]) { fsx.mkdirSync(p, { mode: 0o700 }); created.push(p); }
    out('ISO_INPUT_OK');
  } catch {
    fail('ISO_E_INPUT');
    try {
      for (const p of created.reverse()) fsx.rmdirSync(p);
      if (created.some((p) => fsx.existsSync(p))) throw new Error('left');
    } catch { fail('ISO_E_INPUT_ROLLBACK'); }
    return { ok, say };
  }

  // Host diagnostics: read-only queries; a failure prints UNKNOWN and never changes the run's verdict. r8: inside the try,
  // so teardown and evidence preservation run even if the diagnostics were ever to throw.
  let hd = Object.fromEntries(HOST_DIAG_ORDER.map((k) => [k, 'UNKNOWN']));
  try {
    hd = await hostDiag(d, x, fsx, shell);
    // r10 (REVIEW DIFF, unapplied): the committed profile must hash to the reviewed bytes before anything is built or created.
    // Docker re-reads the file at create; the inspect check compares the compacted content against these same bytes.
    const seccompPath = path.join(repo, SECCOMP_PROFILE_REL);
    let seccompText = null;
    try { const raw = fsx.readFileSync(seccompPath); if (crypto.createHash('sha256').update(raw).digest('hex') === SECCOMP_RAW_SHA256) seccompText = raw.toString('utf8'); } catch { seccompText = null; }
    if (seccompText === null) fail('ISO_E_PROFILE');
    // r10: the shell the container will launch must be the reviewed binary, by path layout and by digest, before any
    // build or start. The digest is BROWSER_PIN.SHA256; d.browserSha256 is a unit-test seam that main() never sets
    // (a test asserts that), because fakes cannot produce a preimage of the real digest.
    const wantSha = d.browserSha256 ?? BROWSER_PIN.SHA256;
    let shellOk = false;
    try { shellOk = BROWSER_PATH_RE.test(shell) && sha(fsx, shell) === wantSha; } catch { shellOk = false; }
    if (!shellOk) fail('ISO_E_BROWSER_PIN');

    if (ok) {
      const b = await (d.buildImage ?? buildImage)({ ...d, exec: x }, { ctl: H, node, shell }); // ldd/build/inspect clients tracked too
      if (typeof b === 'string') { fail(b); } else {
        buildInvoked = true; imageId = b.id;
        if (b.code === 'ISO_IMAGE_OK' && imageId) out(b.code); else fail(b.code === 'ISO_IMAGE_OK' ? 'ISO_E_IMAGE_BUILD' : b.code);
      }
    }

    if (ok) {
      let spawnError = false;
      try {
        child = d.spawnEndpoint(path.join(repo, 'scripts/e2e/le-iso/host-endpoint.mjs'), S, H);
        child.on('error', () => { spawnError = true; }); // an async spawn failure is a fixed code, never an uncaught exception
      } catch { child = null; spawnError = true; }
      let rec = null;
      for (let i = 0; i < 50 && !rec && !spawnError; i++) { try { rec = fsx.readFileSync(path.join(H, 'ready'), 'utf8'); } catch { await d.sleep(200); } }
      const m = rec?.match(/^(\d+) (\d+) (\d+)\n$/);
      if (spawnError || !m || !child || !Number.isInteger(child.pid)) fail('ISO_E_ENDPOINT_START');
      else {
        endpoint = { pid: Number(m[1]), start: m[2] };
        let st = null;
        try { st = starttimeOf(fsx, endpoint.pid); } catch { st = null; }
        if (endpoint.pid !== child.pid || st !== endpoint.start) fail('ISO_E_ENDPOINT_IDENTITY'); else out('ISO_ENDPOINT_OK');
      }
    }

    if (ok) {
      const cidfile = path.join(H, 'lane.cid');
      createTried = true;
      const c = await x('docker', createArgs({ cidfile, imageId, uid: d.uid(), gid: d.gid(), repo, sock: S, out: O, node, shell, seccompPath }));
      let read = null;
      try { read = fsx.readFileSync(cidfile, 'utf8').trim(); } catch { read = null; }
      const said = c.stdout.trim();
      const fromFile = read && CID.test(read) ? read : null, fromOut = CID.test(said) ? said : null;
      // Run identity: the cidfile, else create's stdout. Two valid ids that disagree leave the identity UNKNOWN (cid null).
      cid = fromFile && fromOut && fromFile !== fromOut ? null : fromFile ?? fromOut;
      if (!c.ok) fail('ISO_E_CREATE');
      else if (!cid || !fromFile || fromFile !== fromOut) fail('ISO_E_CID');
      else out('ISO_CREATE_OK');
    }

    if (ok) {
      const i = await x('docker', ['container', 'inspect', cid]);
      let obj = null;
      try { obj = JSON.parse(i.stdout)[0]; } catch { obj = null; }
      const bad = !i.ok ? ['INSPECT_EXEC'] : !obj ? ['INSPECT_PARSE'] : obj.Id !== cid ? ['INSPECT_ID']
        : compareInspect(obj, expectedConfig({ imageId, uid: d.uid(), gid: d.gid(), repo, sock: S, out: O, seccompText }));
      // The check is unchanged; only the NAMES of the differing fields are printed (fixed list, never values).
      if (bad.length) { fail('ISO_E_CONFIG'); for (const l of configFieldLines(bad)) out(l); } else out('ISO_CONFIG_OK');
      const ap = obj && typeof obj.AppArmorProfile === 'string' ? obj.AppArmorProfile : null;
      hd.CONTAINER_APPARMOR = ap == null ? 'UNKNOWN' : ap === '' ? 'EMPTY' : ap === 'docker-default' ? 'DOCKER_DEFAULT' : ap === 'unconfined' ? 'UNCONFINED' : 'OTHER';
    }

    if (ok) {
      // Bounded client: at 300 s the docker CLI gets SIGTERM, then SIGKILL; the CID is kept and the container is stopped
      // host-side in teardown (killing the client does not stop the container).
      startInvoked = true;
      const r = await x('docker', ['start', '-a', cid], { timeout: 300000, max: 1 << 16 });
      const cls = classifyInner(r.stdout);
      if (r.timedOut) fail('ISO_E_START_TIMEOUT');
      else if (!cls.ok && !r.ok) fail('ISO_E_START');
      else if (!cls.ok) { out('ISO_RUN_DONE'); fail('ISO_E_INNER_OUTPUT'); }
      else {
        out('ISO_RUN_DONE'); for (const t of INNER_ORDER) out(`LE-ISO ${t} ${cls.results[t]}`);
        for (const k of INNER_DIAG_ORDER) out(`LE-ISO-DIAG ${k} ${cls.diag[k]}`);
        innerPass = cls.pass && r.ok;
      }
    }
    for (const k of HOST_DIAG_ORDER) out(hostDiagLine(k, hd[k]));
  } finally {
    // Teardown, always; each gate has its own code; no retry. The run identity (control dir with lane.cid, image.id, ready,
    // final) and the bound dirs are PRESERVED unless cleanup is positively established: container absent, endpoint gone.
    let containerGone = !createTried; // nothing was created, so nothing can survive
    if (createTried && !cid) fail('ISO_E_CID_UNKNOWN');
    if (cid) {
      // Started (start was invoked): explicit, bounded stop, because `docker start -a` returning (or its client being
      // killed) does not stop the container; then a bounded wait. Never started: no stop/wait (run 41718226106 showed stop
      // failing on a created container); the inspect below must then VERIFY the created-never-started state.
      let waited = true;
      if (startInvoked) {
        // r5: `-t`, not `--time`. Docker CLI 28.x deprecated --time; cobra prints the pflag deprecation notice through
        // c.Print -> OutOrStderr, and the docker root command sets Out to stdout, so the notice preceded the id on stdout.
        // `-t` is the shorthand in CLI v24.0.9 and v27.5.1 (of --time) and v28.0.4 and v29.0.0 (of --timeout), as checked in
        // docker/cli cli/command/container/stop.go at those tags. The identity check stays exact.
        const st = await x('docker', ['stop', '-t', '10', cid], { timeout: 30000 });
        if (st.timedOut) fail('ISO_E_STOP_TIMEOUT'); else if (!st.ok) fail('ISO_E_STOP_STATUS');
        else if (st.stdout.trim() !== cid) { fail('ISO_E_STOP_OUTPUT'); out(stopOutputCategory(st.stdout, cid)); } else out('ISO_STOP_OK');
        const w = await x('docker', ['wait', cid], { timeout: 30000 });
        waited = w.ok && /^-?\d+$/.test(w.stdout.trim());
        if (w.timedOut) fail('ISO_E_WAIT_TIMEOUT'); else if (!waited) fail('ISO_E_WAIT');
      } else out('ISO_STOP_SKIPPED_NEVER_STARTED');
      const i = await x('docker', ['container', 'inspect', cid]);
      let obj = null;
      try { obj = JSON.parse(i.stdout)[0]; } catch { obj = null; }
      const seen = i.ok && !!obj && obj.Id === cid;
      const neverStarted = seen && createdNeverStarted(obj);
      const exited = seen && waited && startInvoked && exitStateOk(obj);
      const stopped = exited || neverStarted;
      if (exited) out('ISO_EXIT_OK'); else if (neverStarted) out('ISO_CREATED_NEVER_STARTED'); else fail('ISO_E_EXIT_STATE');
      if (stopped) {
        // rm only a container positively seen stopped (no -f); then require a successful, empty listing.
        const rm = await x('docker', ['rm', cid], { timeout: 30000 });
        if (!rm.ok || rm.stdout.trim() !== cid) fail('ISO_E_RM'); else out('ISO_RM_OK');
        const ls = await x('docker', ['container', 'ls', '-a', '--no-trunc', '--filter', `id=${cid}`, '--format', '{{.ID}}'], { timeout: 30000 });
        const v = absenceVerdict(ls.ok, ls.stdout, cid);
        if (v === 'absent') { out('ISO_ABSENT'); containerGone = true; } else fail(v === 'present' ? 'ISO_E_STILL_PRESENT' : 'ISO_E_ABSENCE_UNDECIDED');
      }
    }
    // Endpoint termination goes through our own ChildProcess handle: until Node reaps it (the 'exit' event), its pid cannot
    // be reused, so the handle IS the identity. The /proc start-time record is checked as well; a mismatch is a failure but
    // never a reason to leave our own child running. SIGTERM, bounded wait, then one bounded SIGKILL; reaped = gone.
    let endpointGone = !child || !Number.isInteger(child.pid);
    if (child && Number.isInteger(child.pid)) {
      let reaped = child.exitCode !== null || child.signalCode !== null;
      const exited = reaped ? Promise.resolve(child.exitCode) : new Promise((r) => child.once('exit', (code) => { reaped = true; r(code); }));
      if (endpoint) {
        let same = false;
        try { same = endpoint.pid === child.pid && starttimeOf(fsx, endpoint.pid) === endpoint.start; } catch { same = false; }
        if (!same && !reaped) fail('ISO_E_ENDPOINT_IDENTITY_CHANGED');
      }
      let code = reaped ? child.exitCode : null;
      if (!reaped) {
        try { child.kill('SIGTERM'); } catch { /* reported below by the reap check */ }
        code = await Promise.race([exited, d.sleep(10000).then(() => 'timeout')]);
        if (code === 'timeout') {
          try { child.kill('SIGKILL'); } catch { /* reported below */ }
          await Promise.race([exited, d.sleep(5000)]);
          fail('ISO_E_ENDPOINT_TERMINATION');
          if (reaped) out('ISO_ENDPOINT_KILLED');
        }
      }
      let procGone = true;
      if (endpoint) { try { fsx.statSync(`/proc/${endpoint.pid}`); procGone = false; } catch (e) { procGone = e?.code === 'ENOENT'; } }
      endpointGone = reaped && procGone;
      if (!endpointGone) fail('ISO_E_ENDPOINT_TERMINATION');
      else if (code !== 'timeout') {
        let fin = null;
        try { fin = fsx.readFileSync(path.join(H, 'final'), 'utf8').match(/^(\d+) (\d+)\n$/); } catch { fin = null; }
        // Connections: a container that ran must have used the endpoint (>= 1); one that never started must not have
        // (exactly 0). Either way none may remain open. Termination and absence gates above are unchanged.
        const want = (n) => (startInvoked ? n >= 1 : n === 0);
        if (code !== 0) fail('ISO_E_ENDPOINT_TERMINATION');
        else if (!fin || !want(Number(fin[1])) || Number(fin[2]) !== 0) fail('ISO_E_ENDPOINT_CONNS');
        else if (endpoint) out('ISO_ENDPOINT_STOPPED');
      }
    }
    // Image: gone only when never built, or removed AND absent from a well-formed full listing. A build that was invoked
    // without a confirmed id, a failed rm, or a failed/odd listing leaves the image UNRESOLVED (image.id kept).
    let imageGone = !buildInvoked;
    if (buildInvoked && !imageId) fail('ISO_E_IMAGE_UNKNOWN');
    else if (imageId && !containerGone) fail('ISO_PRESERVED_IMAGE');
    else if (imageId) {
      const r = await x('docker', ['image', 'rm', imageId], { timeout: 60000 });
      if (!r.ok) fail('ISO_E_IMAGE_REMOVE');
      else {
        const ls = await x('docker', ['image', 'ls', '-a', '-q', '--no-trunc'], { timeout: 30000 });
        const ids = ls.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
        if (!ls.ok || ids.some((x) => !IMAGE_ID.test(x))) fail('ISO_E_IMAGE_ABSENCE');
        else if (ids.includes(imageId)) fail('ISO_E_IMAGE_ABSENCE');
        else { out('ISO_IMAGE_REMOVED'); imageGone = true; }
      }
    }
    if (clientUnreaped) fail('ISO_E_CLIENT_UNREAPED');
    if (!containerGone || !endpointGone || !imageGone || clientUnreaped) fail('ISO_PRESERVED_DIRS');
    else {
      try {
        for (const p of [H, S, O]) fsx.rmSync(p, { recursive: true, force: false });
        if ([H, S, O].some((p) => fsx.existsSync(p))) throw new Error('left');
        out('ISO_DIRS_REMOVED');
      } catch { fail('ISO_E_DIRS'); }
    }
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
