// ABOUTME: Pure rules for the lane-isolation feasibility probe: the exact container config the host expects, the fixed
// ABOUTME: public codes, the absence rule, the ld.so closure parser and the in-container result classifier. No I/O here.
//
// Synthetic probe only: no stack, credentials, fixtures, E1, pairing, migrations or policy change. Every printed token is
// one of the fixed codes below; nothing from docker output, /proc, an error message or a path is ever printed.

/** Every line the host side may print. */
export const HOST_CODES = Object.freeze([
  'ISO_INPUT_OK', 'ISO_E_INPUT', 'ISO_E_INPUT_ROLLBACK',
  'ISO_IMAGE_OK', 'ISO_E_IMAGE_BUILD', 'ISO_E_IMAGE_CONFIG', 'ISO_E_IMAGE_MANIFEST', 'ISO_E_IMAGE_CLOSURE',
  'ISO_ENDPOINT_OK', 'ISO_E_ENDPOINT_START', 'ISO_E_ENDPOINT_IDENTITY',
  'ISO_CREATE_OK', 'ISO_E_CREATE', 'ISO_E_CID', 'ISO_E_CID_UNKNOWN',
  'ISO_CONFIG_OK', 'ISO_E_CONFIG',
  'ISO_RUN_DONE', 'ISO_E_START', 'ISO_E_START_TIMEOUT',
  'ISO_STOP_OK', 'ISO_E_STOP_STATUS', 'ISO_E_STOP_TIMEOUT', 'ISO_E_STOP_OUTPUT', 'ISO_STOP_SKIPPED_NEVER_STARTED',
  'ISO_STOP_OUTPUT_EMPTY', 'ISO_STOP_OUTPUT_ID_PLUS_LINES', 'ISO_STOP_OUTPUT_OTHER',
  'ISO_EXIT_OK', 'ISO_CREATED_NEVER_STARTED', 'ISO_E_EXIT_STATE', 'ISO_E_WAIT', 'ISO_E_WAIT_TIMEOUT', 'ISO_E_CLIENT_UNREAPED',
  'ISO_RM_OK', 'ISO_E_RM',
  'ISO_ABSENT', 'ISO_E_ABSENCE_UNDECIDED', 'ISO_E_STILL_PRESENT',
  'ISO_ENDPOINT_STOPPED', 'ISO_E_ENDPOINT_IDENTITY_CHANGED', 'ISO_E_ENDPOINT_TERMINATION', 'ISO_E_ENDPOINT_CONNS', 'ISO_ENDPOINT_KILLED',
  'ISO_IMAGE_REMOVED', 'ISO_E_IMAGE_REMOVE', 'ISO_E_IMAGE_ABSENCE', 'ISO_E_IMAGE_UNKNOWN',
  'ISO_DIRS_REMOVED', 'ISO_E_DIRS', 'ISO_PRESERVED_IMAGE', 'ISO_PRESERVED_DIRS',
  'ISO_INNER_PASS', 'ISO_INNER_FAIL', 'ISO_E_INNER_OUTPUT',
]);

/** Closed categories for an unexpected mount point (first path component class). */
export const MOUNT_CATEGORIES = Object.freeze(['SBIN', 'ETC', 'DEV', 'SYS', 'PROC', 'REPO', 'ISO', 'TMP', 'OTHER']);

/** In-container tests and the ONLY result each may report (`expected`), plus the other allowed codes. */
export const INNER_TESTS = Object.freeze({
  ID: { expected: 'ID_NNP_NOCAPS', other: ['ID_E_NNP', 'ID_E_CAPS', 'ID_E_READ'] },
  // r5: the kernel reports a seccomp filter on the container process (Docker's default profile; mode 2 = filter).
  SECCOMP: { expected: 'SECCOMP_FILTER', other: ['SECCOMP_E_NONE', 'SECCOMP_E_READ'] },
  IFACES: { expected: 'IF_LO_ONLY', other: ['IF_E_EXTRA', 'IF_E_READ'] },
  FWD: { expected: 'FWD_NONCE_MATCH', other: ['FWD_E_MISMATCH', 'FWD_E_CONNECT', 'FWD_E_LISTEN', 'FWD_E_INPUT'] },
  HOSTLO: { expected: 'HOSTLO_REFUSED', other: ['HOSTLO_E_REACHABLE', 'HOSTLO_E_OTHER', 'HOSTLO_E_INPUT'] },
  V4: { expected: 'V4_UNREACHABLE', other: ['V4_E_REACHABLE', 'V4_E_OTHER'] },
  V6: { expected: 'V6_UNREACHABLE', other: ['V6_E_REACHABLE', 'V6_E_OTHER'] },
  V6LO: { expected: 'V6LO_REFUSED', other: ['V6LO_E_REACHABLE', 'V6LO_E_OTHER'] },
  DNS: { expected: 'DNS_NONE', other: ['DNS_E_RESOLVED', 'DNS_E_UNDECIDED'] },
  DOCKSOCK: { expected: 'DOCKSOCK_ABSENT', other: ['DOCKSOCK_E_PRESENT', 'DOCKSOCK_E_OTHER'] },
  RUN: { expected: 'RUN_EMPTY_OR_ABSENT', other: ['RUN_E_CONTENT', 'RUN_E_OTHER'] },
  ROOTFS: { expected: 'ROOTFS_READONLY', other: ['ROOTFS_E_WRITABLE', 'ROOTFS_E_OTHER'] },
  REPO: { expected: 'REPO_READONLY', other: ['REPO_E_WRITABLE', 'REPO_E_OTHER'] },
  // r5: TMP_E_MODE = /tmp is not a directory of mode 0700 owned by the probe uid:gid; errno split into closed classes.
  TMP: { expected: 'TMP_WRITABLE', other: ['TMP_E_DENIED', 'TMP_E_ROFS', 'TMP_E_MODE', 'TMP_E_OTHER'] },
  OUT: { expected: 'OUT_WRITABLE', other: ['OUT_E_DENIED'] },
  SHM: { expected: 'SHM_PRIVATE_WRITABLE', other: ['SHM_E_ABSENT', 'SHM_E_OTHER'] },
  EXEC: { expected: 'EXEC_ALLOWED_NO_GAIN', other: ['EXEC_E_GAIN', 'EXEC_E_SPAWN'] },
  // r5: an unexpected mount point is reported by closed category only (never a path); MULTI = more than one category.
  MOUNTS: { expected: 'MOUNTS_EXACT', other: [...MOUNT_CATEGORIES.map((c) => `MOUNTS_E_UNEXPECTED_${c}`), 'MOUNTS_E_UNEXPECTED_MULTI',
    'MOUNTS_E_INIT_RW', 'MOUNTS_E_MISSING', 'MOUNTS_E_READ'] },
  // r5: a launch failure is classified (closed list) from the error in-process; the message itself is never printed.
  SANDBOX: { expected: 'SANDBOX_ON_NONCE_MATCH', other: ['SANDBOX_E_LAUNCH', 'SANDBOX_E_LAUNCH_TMPDIR', 'SANDBOX_E_LAUNCH_NO_USABLE_SANDBOX',
    'SANDBOX_E_LAUNCH_TIMEOUT', 'SANDBOX_E_FLAG', 'SANDBOX_E_NONCE', 'SANDBOX_E_INPUT'] },
});
export const INNER_ORDER = Object.freeze(Object.keys(INNER_TESTS));

/**
 * r7 DIAGNOSTICS ONLY (never pass/fail): closed-list codes about the sandbox's launch constraints, read without changing
 * any flag. In-container lines are `LE-ISO-DIAG <KEY> <CODE>`, printed after the tests and before END, in this order.
 */
export const INNER_DIAG = Object.freeze({
  SECCOMP_FILTERS: ['ONE', 'MANY', 'ZERO', 'UNKNOWN'], // /proc/self/status Seccomp_filters
  APPARMOR_LABEL: ['DOCKER_DEFAULT_ENFORCE', 'DOCKER_DEFAULT_OTHER', 'UNCONFINED', 'OTHER', 'UNKNOWN'], // /proc/self/attr
  MAX_USERNS: ['ZERO', 'POSITIVE', 'UNKNOWN'], // /proc/sys/user/max_user_namespaces as seen in the container
});
export const INNER_DIAG_ORDER = Object.freeze(Object.keys(INNER_DIAG));

/** Host-side DIAGNOSTICS ONLY: `ISO_DIAG <KEY> <CODE>`. VERSION keys print a version only if it matches VERSION_RE. */
export const HOST_DIAG = Object.freeze({
  DOCKER_CLIENT: 'VERSION', DOCKER_SERVER: 'VERSION', RUNC: 'VERSION', KERNEL: 'VERSION',
  DAEMON_SECCOMP: ['BUILTIN', 'UNCONFINED', 'CUSTOM', 'ABSENT', 'UNKNOWN'],
  DAEMON_APPARMOR: ['PRESENT', 'ABSENT', 'UNKNOWN'],
  CONTAINER_APPARMOR: ['DOCKER_DEFAULT', 'UNCONFINED', 'EMPTY', 'OTHER', 'UNKNOWN'],
  HOST_MAX_USERNS: ['ZERO', 'POSITIVE', 'ABSENT', 'UNKNOWN'],
  HOST_AA_RESTRICT_USERNS: ['ON', 'OFF', 'ABSENT', 'UNKNOWN'],
  HOST_USERNS_CLONE: ['ON', 'OFF', 'ABSENT', 'UNKNOWN'],
  SUID_HELPER: ['PRESENT', 'ABSENT', 'UNKNOWN'],
});
export const HOST_DIAG_ORDER = Object.freeze(Object.keys(HOST_DIAG));
export const VERSION_RE = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/;

/** One host diagnostic line; a value outside the key's closed list (or not a plain version) prints UNKNOWN. */
export function hostDiagLine(key, value) {
  const spec = HOST_DIAG[key];
  if (!spec) return 'ISO_DIAG UNKNOWN UNKNOWN';
  const ok = spec === 'VERSION' ? typeof value === 'string' && VERSION_RE.test(value) : spec.includes(value);
  return `ISO_DIAG ${key} ${ok ? value : 'UNKNOWN'}`;
}

/** Daemon security options (docker info .SecurityOptions, e.g. "name=seccomp,profile=builtin") to closed codes. */
export function daemonSecurity(opts) {
  if (!Array.isArray(opts)) return { seccomp: 'UNKNOWN', apparmor: 'UNKNOWN' };
  const sc = opts.find((o) => typeof o === 'string' && /^name=seccomp(,|$)/.test(o));
  const prof = sc ? (sc.split(',').find((k) => k.startsWith('profile=')) ?? '').slice(8) : null;
  return {
    seccomp: !sc ? 'ABSENT' : prof === 'builtin' || prof === 'default' ? 'BUILTIN' : prof === 'unconfined' ? 'UNCONFINED' : prof ? 'CUSTOM' : 'UNKNOWN',
    apparmor: opts.some((o) => o === 'name=apparmor' || (typeof o === 'string' && o.startsWith('name=apparmor,'))) ? 'PRESENT' : 'ABSENT',
  };
}

/** A /proc/sys integer file's text to ZERO/POSITIVE (max_user_namespaces) or OFF/ON (0/1 switches); else UNKNOWN. */
export function sysctlClass(text, kind) {
  const v = typeof text === 'string' ? text.trim() : '';
  if (!/^\d{1,10}$/.test(v)) return 'UNKNOWN';
  if (kind === 'count') return v === '0' ? 'ZERO' : 'POSITIVE';
  return v === '0' ? 'OFF' : v === '1' ? 'ON' : 'UNKNOWN';
}

/** An AppArmor label (/proc/self/attr/...) to a closed code. */
export function apparmorLabel(text) {
  const v = typeof text === 'string' ? text.replace(/\0/g, '').trim() : '';
  if (!v) return 'UNKNOWN';
  if (v === 'unconfined') return 'UNCONFINED';
  if (v === 'docker-default (enforce)') return 'DOCKER_DEFAULT_ENFORCE';
  if (v.startsWith('docker-default')) return 'DOCKER_DEFAULT_OTHER';
  return 'OTHER';
}

/**
 * Every field name compareInspect can report, plus the three inspect-read failures. The host prints a mismatch ONLY as
 * `ISO_CONFIG_FIELD <name>` with a name from this list (anything else prints UNKNOWN): never a value, path or id.
 */
export const CONFIG_FIELDS = Object.freeze(['INSPECT_EXEC', 'INSPECT_PARSE', 'INSPECT_ID', 'INSPECT', 'Image', 'User', 'Volumes',
  'ExposedPorts', 'NetworkMode', 'PidMode', 'IpcMode', 'UTSMode', 'UsernsMode', 'CgroupnsMode', 'Privileged', 'ReadonlyRootfs',
  'PublishAllPorts', 'AutoRemove', 'Init', 'CapAdd', 'CapDrop', 'SecurityOpt', 'Devices', 'DeviceCgroupRules', 'VolumesFrom',
  'Links', 'ExtraHosts', 'Dns', 'DnsSearch', 'DnsOptions', 'Binds', 'RestartPolicy', 'LogConfig', 'Tmpfs', 'PortBindings', 'Mounts',
  'NanoCpus', 'Memory', 'MemorySwap', 'PidsLimit', 'ShmSize', 'EffectiveMounts']);

/** The fixed diagnostic lines for a config mismatch (field names only, de-duplicated, list order). */
export function configFieldLines(bad) {
  const names = [...new Set(bad)];
  return names.map((n) => `ISO_CONFIG_FIELD ${CONFIG_FIELDS.includes(n) ? n : 'UNKNOWN'}`);
}

/** Container resource bounds (passed to docker create and checked in inspect). */
export const LIMITS = Object.freeze({ NanoCpus: 1_000_000_000, Memory: 1_073_741_824, MemorySwap: 1_073_741_824, PidsLimit: 256, ShmSize: 67_108_864 });

/** Paths inside the container (fixed; the host binds exactly these). */
export const IN = Object.freeze({ sock: '/iso/sock', out: '/iso/out', tmp: '/tmp' });

/**
 * Docker's in-container init path when --init is set (moby v28.0.4 daemon/oci_linux.go: inContainerInitPath =
 * "/sbin/" + DefaultInitBinary, DefaultInitBinary = "docker-init"; added as a bind mount with options bind,ro).
 */
export const INIT_PATH = '/sbin/docker-init';

/**
 * The /tmp tmpfs options. runc mounts a tmpfs over an EXISTING target with mode=<target's mode> prepended to the data
 * (runc libcontainer/rootfs_linux.go "If the original target exists, copy the mode for the tmpfs mount"); the image's /tmp
 * is root-owned 0755, so without an explicit mode the probe uid cannot write. r5 states mode/uid/gid explicitly (later
 * options win), giving the probe uid alone a private 0700 /tmp: narrower than the conventional 1777. No new mount.
 */
export function tmpfsSpec(uid, gid) {
  if (!Number.isInteger(uid) || !Number.isInteger(gid) || uid < 0 || gid < 0) throw new Error('tmpfsSpec: integer uid/gid required');
  return `rw,nosuid,nodev,size=64m,mode=0700,uid=${uid},gid=${gid}`;
}

/**
 * The exact config the host expects from `docker inspect <cid>`. repo = absolute repo path (bound read-only at the same
 * path), sock/out = host dirs, imageId = the locally built image id, uid/gid = the runner's ids.
 */
export function expectedConfig({ imageId, uid, gid, repo, sock, out }) {
  return {
    Image: imageId,
    User: `${uid}:${gid}`,
    NetworkMode: 'none', PidMode: '', IpcMode: 'private', UTSMode: '', UsernsMode: '', CgroupnsMode: 'private',
    Privileged: false, ReadonlyRootfs: true, PublishAllPorts: false,
    CapAdd: [], CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'],
    Devices: [], DeviceCgroupRules: [], VolumesFrom: [], Links: [], ExtraHosts: [], Dns: [], DnsSearch: [], DnsOptions: [],
    RestartPolicy: { Name: 'no', MaximumRetryCount: 0 },
    LogConfig: { Type: 'none' },
    AutoRemove: false, Init: true,
    Tmpfs: { '/tmp': tmpfsSpec(uid, gid) },
    Binds: [`${repo}:${repo}:ro,rprivate`, `${sock}:${IN.sock}:ro,rprivate`, `${out}:${IN.out}:rw,rprivate`],
    PortBindings: {},
    ...LIMITS,
    // Effective mounts, by destination: exact host source, read/write bit and propagation.
    EffectiveMounts: [
      { Type: 'bind', Source: repo, Destination: repo, RW: false, Propagation: 'rprivate' },
      { Type: 'bind', Source: sock, Destination: IN.sock, RW: false, Propagation: 'rprivate' },
      { Type: 'bind', Source: out, Destination: IN.out, RW: true, Propagation: 'rprivate' },
    ].sort((a, b) => a.Destination.localeCompare(b.Destination)),
  };
}

const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : null);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Compare one container inspect object with the expectation. Returns a list of FIELD names that differ (never values).
 * An empty list means the config is exactly as expected. Mounts are checked separately against Binds + Tmpfs only.
 */
export function compareInspect(inspect, exp) {
  const bad = [];
  if (!inspect || typeof inspect !== 'object') return ['INSPECT'];
  const hc = inspect.HostConfig ?? {};
  const cfg = inspect.Config ?? {};
  if (inspect.Image !== exp.Image) bad.push('Image');
  if (cfg.User !== exp.User) bad.push('User');
  if (cfg.Volumes != null && Object.keys(cfg.Volumes).length) bad.push('Volumes');
  if (cfg.ExposedPorts != null && Object.keys(cfg.ExposedPorts).length) bad.push('ExposedPorts');
  for (const k of ['NetworkMode', 'PidMode', 'IpcMode', 'UTSMode', 'UsernsMode', 'CgroupnsMode', 'Privileged', 'ReadonlyRootfs',
    'PublishAllPorts', 'AutoRemove', 'Init']) if ((hc[k] ?? (typeof exp[k] === 'boolean' ? false : '')) !== exp[k]) bad.push(k);
  for (const k of ['CapAdd', 'CapDrop', 'SecurityOpt', 'Devices', 'DeviceCgroupRules', 'VolumesFrom', 'Links', 'ExtraHosts', 'Dns',
    'DnsSearch', 'DnsOptions']) {
    const v = arr(hc[k]);
    if (v === null || !same(v, exp[k])) bad.push(k);
  }
  // Binds (r6): exactly the expected entries, compared as a sorted list. The docker CLI builds HostConfig.Binds by ranging
  // over a Go map (docker/cli v28.0.4 cli/command/container/opts.go: `for bind := range copts.volumes.GetMap()`), so
  // their ORDER varies run to run. Each entry must still match byte for byte, with no extra, missing or duplicate entry.
  { const v = arr(hc.Binds); if (v === null || !same([...v].sort(), [...exp.Binds].sort())) bad.push('Binds'); }
  if (!same(hc.RestartPolicy ?? null, exp.RestartPolicy)) bad.push('RestartPolicy');
  if ((hc.LogConfig ?? {}).Type !== exp.LogConfig.Type) bad.push('LogConfig');
  if (!same(hc.Tmpfs ?? {}, exp.Tmpfs)) bad.push('Tmpfs');
  if (!same(hc.PortBindings ?? {}, exp.PortBindings)) bad.push('PortBindings');
  if (Array.isArray(hc.Mounts) && hc.Mounts.length) bad.push('Mounts');
  for (const k of Object.keys(LIMITS)) if (hc[k] !== exp[k]) bad.push(k);
  // Effective mounts: exactly the three binds (Tmpfs is not listed in .Mounts), each with its exact Source, Destination,
  // RW bit and Propagation. No named or anonymous volume.
  const m = arr(inspect.Mounts);
  const pick = (x) => ({ Type: x?.Type, Source: x?.Source, Destination: x?.Destination, RW: x?.RW, Propagation: x?.Propagation });
  const got = m === null ? null : m.map(pick).sort((a, b) => String(a.Destination).localeCompare(String(b.Destination)));
  if (got === null || !same(got, exp.EffectiveMounts)) bad.push('EffectiveMounts');
  return bad;
}

/**
 * DNS verdict from a bounded lookup: ONLY an immediate ECONNREFUSED (no reachable resolver; c-ares falls back to the
 * namespace's own loopback) counts as isolated. A timeout, NXDOMAIN (ENOTFOUND means something answered) or any other
 * error is undecided, never success.
 */
export function dnsVerdict(outcome) {
  if (outcome === 'resolved') return 'DNS_E_RESOLVED';
  if (outcome === 'ECONNREFUSED') return 'DNS_NONE';
  return 'DNS_E_UNDECIDED';
}

/**
 * A container that was created and verifiably NEVER started: Status created, not running/paused/restarting/dead, no pid,
 * and the zero StartedAt Docker reports for a container that never ran. Only this, or exitStateOk, permits a plain rm.
 */
export function createdNeverStarted(inspect) {
  const s = inspect?.State ?? {};
  return s.Status === 'created' && s.Running === false && s.Paused === false && s.Restarting === false && s.Dead === false
    && s.Pid === 0 && s.StartedAt === '0001-01-01T00:00:00Z';
}

/** The state a finished container must report before removal. */
export function exitStateOk(inspect) {
  const s = inspect?.State ?? {};
  return s.Status === 'exited' && s.Running === false && s.Restarting === false && s.Pid === 0 && s.Dead === false;
}

/**
 * Absence of one exact id from `docker container ls -a --no-trunc --filter id=<id> --format {{.ID}}` (or the image
 * listing): ONLY a successful listing that prints nothing is "absent"; the exact id printed is "present"; anything else
 * (failed listing, daemon/API error, other output) is "undecided". An error is never read as not-found.
 */
export function absenceVerdict(ok, stdout, id) {
  if (!ok) return 'undecided';
  const lines = String(stdout).split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'absent';
  if (lines.length === 1 && (lines[0] === id || `sha256:${lines[0]}` === id || lines[0] === `sha256:${id}`)) return 'present';
  return 'undecided';
}

/** A docker id as printed by --cidfile / image build: exactly 64 lowercase hex, image ids may carry sha256:. */
export const CID = /^[0-9a-f]{64}$/;
export const IMAGE_ID = /^sha256:[0-9a-f]{64}$/;

/** Absolute library paths from `ldd <bin>` output; returns null on any line it cannot account for (fail closed). */
export function parseLdd(text) {
  const out = [];
  for (const raw of String(text).split('\n')) {
    const l = raw.trim();
    if (!l) continue;
    let m;
    if (/^linux-vdso\.so\.\d+ \(0x[0-9a-f]+\)$/.test(l)) continue;
    if ((m = l.match(/^\S+ => (\/[^\s]+) \(0x[0-9a-f]+\)$/))) { out.push(m[1]); continue; }
    if ((m = l.match(/^(\/[^\s]+) \(0x[0-9a-f]+\)$/))) { out.push(m[1]); continue; }
    return null; // "not found", "statically linked", or anything unexpected
  }
  return [...new Set(out)];
}

/**
 * Classify the container's stdout: exactly one line `LE-ISO <TEST> <CODE>` per test in INNER_ORDER, in order, each code
 * from that test's allowlist, then (r7) exactly one `LE-ISO-DIAG <KEY> <CODE>` per INNER_DIAG_ORDER key from its closed list,
 * then `LE-ISO END`. Diagnostics never affect pass. Returns { ok, pass, results, diag } or { ok:false } for any other shape.
 */
export function classifyInner(stdout) {
  const lines = String(stdout).split('\n').filter((l) => l !== '');
  const n = INNER_ORDER.length, k = INNER_DIAG_ORDER.length;
  if (lines.length !== n + k + 1 || lines[lines.length - 1] !== 'LE-ISO END') return { ok: false };
  const results = {}, diag = {};
  for (let i = 0; i < n; i++) {
    const t = INNER_ORDER[i];
    const m = lines[i].match(/^LE-ISO ([A-Z0-9]+) ([A-Z0-9_]+)$/);
    if (!m || m[1] !== t) return { ok: false };
    const spec = INNER_TESTS[t];
    if (m[2] !== spec.expected && !spec.other.includes(m[2])) return { ok: false };
    results[t] = m[2];
  }
  for (let j = 0; j < k; j++) {
    const key = INNER_DIAG_ORDER[j];
    const m = lines[n + j].match(/^LE-ISO-DIAG ([A-Z0-9_]+) ([A-Z0-9_]+)$/);
    if (!m || m[1] !== key || !INNER_DIAG[key].includes(m[2])) return { ok: false };
    diag[key] = m[2];
  }
  return { ok: true, pass: INNER_ORDER.every((t) => results[t] === INNER_TESTS[t].expected), results, diag };
}

/** The closed category of a mount point that is not allowed (never the path itself). */
export function mountCategory(p, { repo }) {
  if (repo && (p === repo || p.startsWith(`${repo}/`))) return 'REPO';
  if (p.startsWith('/iso/') || p === '/iso') return 'ISO';
  const top = p.split('/')[1] ?? '';
  return top === 'sbin' || top === 'usr' ? 'SBIN' : top === 'etc' ? 'ETC' : top === 'dev' ? 'DEV' : top === 'sys' ? 'SYS'
    : top === 'proc' ? 'PROC' : top === 'tmp' ? 'TMP' : 'OTHER';
}

/**
 * Mounts the container may show in /proc/self/mountinfo (mount points only). Docker's own masks are allowed, and (r5) the
 * --init binary at exactly INIT_PATH, which must be present and mounted read-only. An unexpected point is reported only by
 * closed category.
 */
export function mountsVerdict(mountinfo, { repo }) {
  const points = [];
  let initRo = null;
  for (const line of String(mountinfo).split('\n')) {
    if (!line.trim()) continue;
    const f = line.split(' ');
    if (f.length < 10) return 'MOUNTS_E_READ';
    const p = f[4].replace(/\\040/g, ' ');
    points.push(p);
    if (p === INIT_PATH) initRo = f[5].split(',').includes('ro');
  }
  const exact = new Set(['/', IN.sock, IN.out, IN.tmp, repo, INIT_PATH, '/etc/resolv.conf', '/etc/hostname', '/etc/hosts', '/dev',
    '/dev/pts', '/dev/shm', '/dev/mqueue', '/dev/console', '/proc', '/sys', '/sys/fs/cgroup']);
  const allowedPrefix = (p) => p.startsWith('/proc/') || p.startsWith('/sys/firmware') || p.startsWith('/sys/devices/virtual/powercap');
  const cats = new Set(points.filter((p) => !exact.has(p) && !allowedPrefix(p)).map((p) => mountCategory(p, { repo })));
  if (cats.size > 1) return 'MOUNTS_E_UNEXPECTED_MULTI';
  if (cats.size === 1) return `MOUNTS_E_UNEXPECTED_${[...cats][0]}`;
  for (const need of ['/', IN.sock, IN.out, IN.tmp, repo, INIT_PATH]) if (!points.includes(need)) return 'MOUNTS_E_MISSING';
  if (initRo !== true) return 'MOUNTS_E_INIT_RW';
  return 'MOUNTS_EXACT';
}

/**
 * Closed category of a `docker stop` stdout that is NOT exactly the run id (the run still fails ISO_E_STOP_OUTPUT; this only
 * classifies). ID_PLUS_LINES = the id is the last line but other lines came first (e.g. a CLI deprecation notice).
 */
export function stopOutputCategory(stdout, cid) {
  const lines = String(stdout).split('\n').map((l) => l.trim()).filter((l) => l !== '');
  if (lines.length === 0) return 'ISO_STOP_OUTPUT_EMPTY';
  if (lines.length > 1 && lines.at(-1) === cid) return 'ISO_STOP_OUTPUT_ID_PLUS_LINES';
  return 'ISO_STOP_OUTPUT_OTHER';
}

/**
 * Classify a Chromium launch error in-process (the message is read, never printed). NO_USABLE_SANDBOX = Chrome's fatal
 * "No usable sandbox!" (content/browser/zygote_host/zygote_host_impl_linux.cc); TMPDIR = Playwright's mkdtemp under
 * os.tmpdir() failed (playwright-core 1.59.1 server/browserType.js); TIMEOUT = Playwright TimeoutError.
 */
export function launchErrorCode(e) {
  const msg = typeof e?.message === 'string' ? e.message : '';
  if (msg.includes('No usable sandbox')) return 'SANDBOX_E_LAUNCH_NO_USABLE_SANDBOX';
  if (e?.syscall === 'mkdtemp' || /mkdtemp/.test(msg)) return 'SANDBOX_E_LAUNCH_TMPDIR';
  if (e?.name === 'TimeoutError') return 'SANDBOX_E_LAUNCH_TIMEOUT';
  return 'SANDBOX_E_LAUNCH';
}
