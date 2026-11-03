#!/usr/bin/env node
// ABOUTME: Runs INSIDE the sealed probe container. Checks network, mount, privilege and Chromium-sandbox isolation against
// ABOUTME: a dummy host nonce endpoint only, and prints exactly one fixed `LE-ISO <TEST> <CODE>` line per test, then END.
//
// Usage (container entry): node inner-probe.mjs <repo abs path> <headless shell abs path>
// Synthetic only: the sole peer is the job's dummy nonce endpoint behind /iso/sock/api.sock. No stack, credential, fixture,
// pairing or E1. Errors are mapped to fixed codes; no message, errno text, path or value is printed.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import dns from 'node:dns/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { IN, INNER_ORDER, INNER_TESTS, mountsVerdict } from './expect.mjs';

const FWD_PORT = 54321;
const results = {};
const set = (t, code) => { results[t] = code; };

const capsZero = (status) => ['CapInh', 'CapPrm', 'CapEff', 'CapBnd', 'CapAmb']
  .every((k) => (status.split('\n').find((l) => l.startsWith(`${k}:`)) ?? 'x').split(/\s+/)[1] === '0000000000000000');
const nnp = (status) => (status.split('\n').find((l) => l.startsWith('NoNewPrivs:')) ?? '').split(/\s+/)[1] === '1';

/** Connect with a bound; resolves to 'connected' | errno code | 'timeout'. Never throws. */
export function tryConnect(opts, ms = 3000) {
  return new Promise((resolve) => {
    let done = false;
    const s = net.connect(opts);
    const end = (v) => { if (!done) { done = true; s.destroy(); resolve(v); } };
    s.once('connect', () => end('connected'));
    s.once('error', (e) => end(typeof e?.code === 'string' ? e.code : 'OTHER'));
    setTimeout(() => end('timeout'), ms).unref();
  });
}

/** Unreachable means the kernel has no route: ENETUNREACH / EHOSTUNREACH / EADDRNOTAVAIL (no non-lo interface). */
export const unreachable = (r) => ['ENETUNREACH', 'EHOSTUNREACH', 'EADDRNOTAVAIL'].includes(r);

function readSmall(p, max = 4096) {
  const fd = fs.openSync(p, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { const b = Buffer.alloc(max + 1); const n = fs.readSync(fd, b, 0, max + 1, 0); if (n > max) throw new Error('size'); return b.subarray(0, n).toString('utf8'); }
  finally { fs.closeSync(fd); }
}

/** In-container loopback forwarder: 127.0.0.1:FWD_PORT -> the read-only-mounted unix socket. */
function startForwarder(sockPath) {
  return new Promise((resolve) => {
    const srv = net.createServer((c) => {
      const u = net.connect(sockPath);
      c.pipe(u); u.pipe(c);
      const kill = () => { c.destroy(); u.destroy(); };
      c.on('error', kill); u.on('error', kill); c.on('close', kill); u.on('close', kill);
    });
    srv.once('error', () => resolve(null));
    srv.listen(FWD_PORT, '127.0.0.1', () => resolve(srv));
  });
}

function httpGetBody(port, ms = 5000) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port });
    const chunks = [];
    let done = false;
    const end = (v) => { if (!done) { done = true; s.destroy(); resolve(v); } };
    s.once('connect', () => s.write('GET / HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n'));
    s.on('data', (d) => { chunks.push(d); if (Buffer.concat(chunks).length > 8192) end(null); });
    s.once('end', () => { const t = Buffer.concat(chunks).toString('utf8'); const i = t.indexOf('\r\n\r\n'); end(i < 0 ? null : t.slice(i + 4)); });
    s.once('error', () => end(null));
    setTimeout(() => end(null), ms).unref();
  });
}

async function main() {
  const [repo, shell] = process.argv.slice(2);
  let nonce = null, hostPort = null;
  try {
    nonce = readSmall(path.join(IN.sock, 'nonce')).trim();
    hostPort = Number(readSmall(path.join(IN.sock, 'hostport')).trim());
    if (!/^[0-9a-f]{32}$/.test(nonce) || !Number.isInteger(hostPort) || hostPort < 1024 || hostPort > 65535 || hostPort === FWD_PORT) { nonce = null; hostPort = null; }
  } catch { nonce = null; hostPort = null; }

  // ID: no_new_privs set and every capability set empty.
  try { const st = readSmall('/proc/self/status', 65536); set('ID', !nnp(st) ? 'ID_E_NNP' : !capsZero(st) ? 'ID_E_CAPS' : 'ID_NNP_NOCAPS'); }
  catch { set('ID', 'ID_E_READ'); }

  // IFACES: only loopback exists.
  try { const k = Object.keys(os.networkInterfaces()); set('IFACES', k.length === 1 && k[0] === 'lo' ? 'IF_LO_ONLY' : 'IF_E_EXTRA'); }
  catch { set('IFACES', 'IF_E_READ'); }

  // FWD: the dummy nonce through loopback -> unix socket -> job-owned host endpoint.
  const fwd = nonce ? await startForwarder(path.join(IN.sock, 'api.sock')) : null;
  if (!nonce) set('FWD', 'FWD_E_INPUT');
  else if (!fwd) set('FWD', 'FWD_E_LISTEN');
  else { const body = await httpGetBody(FWD_PORT); set('FWD', body === null ? 'FWD_E_CONNECT' : body.trim() === nonce ? 'FWD_NONCE_MATCH' : 'FWD_E_MISMATCH'); }

  // HOSTLO: the host endpoint's own TCP port is NOT reachable on this namespace's loopback.
  if (!hostPort) set('HOSTLO', 'HOSTLO_E_INPUT');
  else { const r = await tryConnect({ host: '127.0.0.1', port: hostPort }); set('HOSTLO', r === 'ECONNREFUSED' ? 'HOSTLO_REFUSED' : r === 'connected' ? 'HOSTLO_E_REACHABLE' : 'HOSTLO_E_OTHER'); }

  // V4 / V6: no route anywhere (documentation ranges and the default bridge gateway); V6LO: ::1 has no listener.
  const v4 = [await tryConnect({ host: '192.0.2.1', port: 80 }), await tryConnect({ host: '172.17.0.1', port: 80 })];
  set('V4', v4.some((r) => r === 'connected') ? 'V4_E_REACHABLE' : v4.every(unreachable) ? 'V4_UNREACHABLE' : 'V4_E_OTHER');
  const v6 = await tryConnect({ host: '2001:db8::1', port: 80 });
  set('V6', v6 === 'connected' ? 'V6_E_REACHABLE' : unreachable(v6) ? 'V6_UNREACHABLE' : 'V6_E_OTHER');
  const v6lo = hostPort ? await tryConnect({ host: '::1', port: hostPort }) : 'OTHER';
  set('V6LO', v6lo === 'connected' ? 'V6LO_E_REACHABLE' : ['ECONNREFUSED', 'EADDRNOTAVAIL'].includes(v6lo) ? 'V6LO_REFUSED' : 'V6LO_E_OTHER');

  // DNS: a lookup does not resolve. Docker may still write nameserver lines into resolv.conf under --network none (they
  // are unreachable without a route), so the file's content is not the test; the failed resolution is.
  {
    const res = await Promise.race([dns.resolve4('example.com').then(() => 'resolved', () => 'failed'), new Promise((r) => setTimeout(() => r('failed'), 4000).unref())]);
    set('DNS', res === 'resolved' ? 'DNS_E_RESOLVED' : 'DNS_NONE');
  }

  // DOCKSOCK / RUN: no daemon socket and no host /run content.
  const exists = (p) => { try { fs.lstatSync(p); return true; } catch (e) { if (e?.code === 'ENOENT') return false; throw e; } };
  try { set('DOCKSOCK', ['/var/run/docker.sock', '/run/docker.sock', '/run/containerd/containerd.sock'].some(exists) ? 'DOCKSOCK_E_PRESENT' : 'DOCKSOCK_ABSENT'); }
  catch { set('DOCKSOCK', 'DOCKSOCK_E_OTHER'); }
  try { set('RUN', !exists('/run') || fs.readdirSync('/run').length === 0 ? 'RUN_EMPTY_OR_ABSENT' : 'RUN_E_CONTENT'); }
  catch { set('RUN', 'RUN_E_OTHER'); }

  // ROOTFS / REPO read-only; TMP / OUT writable; SHM is the container's own (private ipc namespace) tmpfs.
  const tryWrite = (dir) => {
    const p = path.join(dir, `.le-iso-${process.pid}`);
    try { const fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600); fs.closeSync(fd); fs.unlinkSync(p); return 'ok'; }
    catch (e) { return typeof e?.code === 'string' ? e.code : 'OTHER'; }
  };
  const ro = (r) => r === 'EROFS' || r === 'EACCES';
  { const r = tryWrite('/'); set('ROOTFS', r === 'ok' ? 'ROOTFS_E_WRITABLE' : ro(r) ? 'ROOTFS_READONLY' : 'ROOTFS_E_OTHER'); }
  { const r = repo ? tryWrite(repo) : 'OTHER'; set('REPO', r === 'ok' ? 'REPO_E_WRITABLE' : ro(r) ? 'REPO_READONLY' : 'REPO_E_OTHER'); }
  set('TMP', tryWrite(IN.tmp) === 'ok' ? 'TMP_WRITABLE' : 'TMP_E_DENIED');
  set('OUT', tryWrite(IN.out) === 'ok' ? 'OUT_WRITABLE' : 'OUT_E_DENIED');
  { const r = tryWrite('/dev/shm'); set('SHM', r === 'ok' ? 'SHM_PRIVATE_WRITABLE' : r === 'ENOENT' ? 'SHM_E_ABSENT' : 'SHM_E_OTHER'); }

  // EXEC: no_new_privs does not stop exec; it stops privilege GAIN. A child exec keeps NNP=1 and empty caps.
  try {
    const c = spawnSync(process.execPath, ['-e', "process.stdout.write(require('fs').readFileSync('/proc/self/status','utf8'))"], { encoding: 'utf8', timeout: 10000, maxBuffer: 1 << 16 });
    set('EXEC', c.status !== 0 ? 'EXEC_E_SPAWN' : nnp(c.stdout) && capsZero(c.stdout) ? 'EXEC_ALLOWED_NO_GAIN' : 'EXEC_E_GAIN');
  } catch { set('EXEC', 'EXEC_E_SPAWN'); }

  // MOUNTS: only the expected mount points (fixed code; no path printed).
  try { set('MOUNTS', mountsVerdict(readSmall('/proc/self/mountinfo', 1 << 16), { repo })); }
  catch { set('MOUNTS', 'MOUNTS_E_READ'); }

  // SANDBOX: Chromium with its sandbox ON (chromiumSandbox: true; Playwright 1.59.1 defaults to false), reaching only the
  // forwarder. Chrome refuses to start when the sandbox cannot be set up, so a successful launch means it is on; the
  // browser's own argv is also checked for --no-sandbox.
  if (!nonce || !shell || !repo || !fwd) set('SANDBOX', 'SANDBOX_E_INPUT');
  else {
    let browser;
    try {
      const req = createRequire(path.join(repo, 'package.json'));
      const { chromium } = req('playwright-core');
      browser = await chromium.launch({ executablePath: shell, chromiumSandbox: true, headless: true, timeout: 30000, env: { HOME: IN.tmp, TMPDIR: IN.tmp } });
      const pid = browser.process?.()?.pid;
      let flagged = true;
      try { flagged = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').includes('--no-sandbox'); } catch { flagged = true; }
      if (flagged) set('SANDBOX', 'SANDBOX_E_FLAG');
      else {
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${FWD_PORT}/`, { timeout: 15000 });
        const text = (await page.textContent('body', { timeout: 5000 }))?.trim();
        set('SANDBOX', text === nonce ? 'SANDBOX_ON_NONCE_MATCH' : 'SANDBOX_E_NONCE');
      }
    } catch { if (!results.SANDBOX) set('SANDBOX', 'SANDBOX_E_LAUNCH'); }
    finally { try { await browser?.close(); } catch { /* the container's pid namespace is torn down after exit anyway */ } }
  }
  if (fwd) fwd.close();

  for (const t of INNER_ORDER) process.stdout.write(`LE-ISO ${t} ${results[t] ?? INNER_TESTS[t].other[0]}\n`);
  process.stdout.write('LE-ISO END\n');
  process.exit(INNER_ORDER.every((t) => results[t] === INNER_TESTS[t].expected) ? 0 : 1);
}

if (process.argv[1] && /inner-probe\.mjs$/.test(process.argv[1])) main().catch(() => { process.stdout.write('LE-ISO END\n'); process.exit(1); });
