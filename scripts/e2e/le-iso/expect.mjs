// ABOUTME: Pure rules for the lane-isolation feasibility probe: the exact container config the host expects, the fixed
// ABOUTME: public codes, the absence rule, the ld.so closure parser and the in-container result classifier. No I/O here.
//
// Synthetic probe only: no stack, credentials, fixtures, E1, pairing, migrations or policy change. Every printed token is
// one of the fixed codes below; nothing from docker output, /proc, an error message or a path is ever printed.

/** Every line the host side may print. */
export const HOST_CODES = Object.freeze([
  'ISO_INPUT_OK', 'ISO_E_INPUT',
  'ISO_IMAGE_OK', 'ISO_E_IMAGE_BUILD', 'ISO_E_IMAGE_CONFIG', 'ISO_E_IMAGE_MANIFEST', 'ISO_E_IMAGE_CLOSURE',
  'ISO_ENDPOINT_OK', 'ISO_E_ENDPOINT_START', 'ISO_E_ENDPOINT_IDENTITY',
  'ISO_CREATE_OK', 'ISO_E_CREATE', 'ISO_E_CID',
  'ISO_CONFIG_OK', 'ISO_E_CONFIG',
  'ISO_RUN_DONE', 'ISO_E_START',
  'ISO_EXIT_OK', 'ISO_E_EXIT_STATE', 'ISO_E_WAIT',
  'ISO_RM_OK', 'ISO_E_RM',
  'ISO_ABSENT', 'ISO_E_ABSENCE_UNDECIDED', 'ISO_E_STILL_PRESENT',
  'ISO_ENDPOINT_STOPPED', 'ISO_E_ENDPOINT_IDENTITY_CHANGED', 'ISO_E_ENDPOINT_TERMINATION', 'ISO_E_ENDPOINT_CONNS',
  'ISO_IMAGE_REMOVED', 'ISO_E_IMAGE_REMOVE', 'ISO_E_IMAGE_ABSENCE',
  'ISO_DIRS_REMOVED', 'ISO_E_DIRS',
  'ISO_INNER_PASS', 'ISO_INNER_FAIL', 'ISO_E_INNER_OUTPUT',
]);

/** In-container tests and the ONLY result each may report (`expected`), plus the other allowed codes. */
export const INNER_TESTS = Object.freeze({
  ID: { expected: 'ID_NNP_NOCAPS', other: ['ID_E_NNP', 'ID_E_CAPS', 'ID_E_READ'] },
  IFACES: { expected: 'IF_LO_ONLY', other: ['IF_E_EXTRA', 'IF_E_READ'] },
  FWD: { expected: 'FWD_NONCE_MATCH', other: ['FWD_E_MISMATCH', 'FWD_E_CONNECT', 'FWD_E_LISTEN', 'FWD_E_INPUT'] },
  HOSTLO: { expected: 'HOSTLO_REFUSED', other: ['HOSTLO_E_REACHABLE', 'HOSTLO_E_OTHER', 'HOSTLO_E_INPUT'] },
  V4: { expected: 'V4_UNREACHABLE', other: ['V4_E_REACHABLE', 'V4_E_OTHER'] },
  V6: { expected: 'V6_UNREACHABLE', other: ['V6_E_REACHABLE', 'V6_E_OTHER'] },
  V6LO: { expected: 'V6LO_REFUSED', other: ['V6LO_E_REACHABLE', 'V6LO_E_OTHER'] },
  DNS: { expected: 'DNS_NONE', other: ['DNS_E_RESOLVED'] },
  DOCKSOCK: { expected: 'DOCKSOCK_ABSENT', other: ['DOCKSOCK_E_PRESENT', 'DOCKSOCK_E_OTHER'] },
  RUN: { expected: 'RUN_EMPTY_OR_ABSENT', other: ['RUN_E_CONTENT', 'RUN_E_OTHER'] },
  ROOTFS: { expected: 'ROOTFS_READONLY', other: ['ROOTFS_E_WRITABLE', 'ROOTFS_E_OTHER'] },
  REPO: { expected: 'REPO_READONLY', other: ['REPO_E_WRITABLE', 'REPO_E_OTHER'] },
  TMP: { expected: 'TMP_WRITABLE', other: ['TMP_E_DENIED'] },
  OUT: { expected: 'OUT_WRITABLE', other: ['OUT_E_DENIED'] },
  SHM: { expected: 'SHM_PRIVATE_WRITABLE', other: ['SHM_E_ABSENT', 'SHM_E_OTHER'] },
  EXEC: { expected: 'EXEC_ALLOWED_NO_GAIN', other: ['EXEC_E_GAIN', 'EXEC_E_SPAWN'] },
  MOUNTS: { expected: 'MOUNTS_EXACT', other: ['MOUNTS_E_UNEXPECTED', 'MOUNTS_E_MISSING', 'MOUNTS_E_READ'] },
  SANDBOX: { expected: 'SANDBOX_ON_NONCE_MATCH', other: ['SANDBOX_E_LAUNCH', 'SANDBOX_E_FLAG', 'SANDBOX_E_NONCE', 'SANDBOX_E_INPUT'] },
});
export const INNER_ORDER = Object.freeze(Object.keys(INNER_TESTS));

/** Paths inside the container (fixed; the host binds exactly these). */
export const IN = Object.freeze({ sock: '/iso/sock', out: '/iso/out', tmp: '/tmp' });

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
    Tmpfs: { '/tmp': 'rw,nosuid,nodev,size=64m' },
    Binds: [`${repo}:${repo}:ro,rprivate`, `${sock}:${IN.sock}:ro,rprivate`, `${out}:${IN.out}:rw,rprivate`],
    PortBindings: {},
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
    'DnsSearch', 'DnsOptions', 'Binds']) {
    const v = arr(hc[k]);
    if (v === null || !same(v, exp[k])) bad.push(k);
  }
  if (!same(hc.RestartPolicy ?? null, exp.RestartPolicy)) bad.push('RestartPolicy');
  if ((hc.LogConfig ?? {}).Type !== exp.LogConfig.Type) bad.push('LogConfig');
  if (!same(hc.Tmpfs ?? {}, exp.Tmpfs)) bad.push('Tmpfs');
  if (!same(hc.PortBindings ?? {}, exp.PortBindings)) bad.push('PortBindings');
  if (Array.isArray(hc.Mounts) && hc.Mounts.length) bad.push('Mounts');
  // Effective mounts: exactly the three binds (Tmpfs is not listed in .Mounts). No named or anonymous volume.
  const m = arr(inspect.Mounts);
  if (m === null || m.length !== 3 || m.some((x) => x?.Type !== 'bind')) bad.push('EffectiveMounts');
  return bad;
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
 * from that test's allowlist, then `LE-ISO END`. Returns { ok, pass, results } or { ok:false } for any other shape.
 */
export function classifyInner(stdout) {
  const lines = String(stdout).split('\n').filter((l) => l !== '');
  if (lines.length !== INNER_ORDER.length + 1 || lines[lines.length - 1] !== 'LE-ISO END') return { ok: false };
  const results = {};
  for (let i = 0; i < INNER_ORDER.length; i++) {
    const t = INNER_ORDER[i];
    const m = lines[i].match(/^LE-ISO ([A-Z0-9]+) ([A-Z0-9_]+)$/);
    if (!m || m[1] !== t) return { ok: false };
    const spec = INNER_TESTS[t];
    if (m[2] !== spec.expected && !spec.other.includes(m[2])) return { ok: false };
    results[t] = m[2];
  }
  return { ok: true, pass: INNER_ORDER.every((t) => results[t] === INNER_TESTS[t].expected), results };
}

/** Mounts the container may show in /proc/self/mountinfo (mount points only). Docker's own masks are allowed. */
export function mountsVerdict(mountinfo, { repo }) {
  const points = [];
  for (const line of String(mountinfo).split('\n')) {
    if (!line.trim()) continue;
    const f = line.split(' ');
    if (f.length < 10) return 'MOUNTS_E_READ';
    points.push(f[4].replace(/\\040/g, ' '));
  }
  const exact = new Set(['/', IN.sock, IN.out, IN.tmp, repo, '/etc/resolv.conf', '/etc/hostname', '/etc/hosts', '/dev', '/dev/pts',
    '/dev/shm', '/dev/mqueue', '/dev/console', '/proc', '/sys', '/sys/fs/cgroup']);
  const allowedPrefix = (p) => p.startsWith('/proc/') || p.startsWith('/sys/firmware') || p.startsWith('/sys/devices/virtual/powercap');
  for (const p of points) if (!exact.has(p) && !allowedPrefix(p)) return 'MOUNTS_E_UNEXPECTED';
  for (const need of ['/', IN.sock, IN.out, IN.tmp, repo]) if (!points.includes(need)) return 'MOUNTS_E_MISSING';
  return 'MOUNTS_EXACT';
}
