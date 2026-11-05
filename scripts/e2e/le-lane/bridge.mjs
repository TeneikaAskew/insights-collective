#!/usr/bin/env node
// ABOUTME: Host bridge for the sealed E1 lane: exactly three unix sockets, each forwarding bytes to one fixed loopback port
// ABOUTME: (API, DB, preview). Seal refuses every later connection BEFORE any upstream connect; close destroys, then waits boundedly.
//
//   bridge.mjs <sock dir> <ctl dir> <api port> <db port> <app port>
// Started ONLY by run-lane.mjs, which owns its whole lifetime (launch, wait, seal, termination and ChildProcess reaping in one
// try/finally). Signals: SIGUSR2 = seal (stop new upstream connects; ack does not wait for drain); SIGTERM = seal (if not
// yet), destroy every connection, wait boundedly for the listeners, record, exit 0.
// Lifetime: Node signal watchers are unref'd, so once seal has closed the listeners and connections drain nothing would keep
// this process alive and it could exit before SIGTERM, leaving no bridge-final. The bridge therefore holds ONE referenced
// owner handle (deps.hold) from listen until close has written bridge-final, and releases it only there (finally). The hold is
// bounded: if the owner sends no SIGTERM within SEALED_HOLD_MAX_MS after seal, the bridge closes itself, records
// `CLOSE CEILING` and exits 4, which run-lane rejects (BRIDGE_E_FINAL). The owner path records `CLOSE OWNER` and exits 0.
//
// Privacy, stated accurately: the bridge never parses, logs or stores the bytes it forwards, but its process buffers DO carry
// credential bytes in transit (JWTs, the DB startup exchange, session tokens). It is a credential-bearing host process until
// run-lane has reaped it. Closing its sockets does NOT prove that DB/API work begun through it has stopped; that stays bounded
// only by the job's independent stack-stop and absence gates.
// Writers (disclosed): the three sockets in <sock dir> (0700 dir, created by the job), and <ctl>/bridge-ready, seal-ack and
// bridge-final (wx, 0600). Nothing else.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export const SOCKETS = Object.freeze(['api', 'db', 'app']);
/** Bound on waiting for the three listener close callbacks AFTER every connection was destroyed (close phase only). */
export const LISTENER_CLOSE_MS = 5000;
/** Bound on the post-seal referenced lifetime when the owner never sends SIGTERM (run-lane's post-seal teardown is far shorter). */
export const SEALED_HOLD_MAX_MS = 300_000;

/**
 * The bridge core. deps: { net, files: { put(path, text) , unlink(path) }, pid, starttime, sleep(ms), hold(), exit(code) }.
 * ports: { api, db, app }. hold() returns { release() } for one referenced handle that keeps the process alive.
 * Two separate phases, so neither waits on the other:
 *   seal():  sets `sealed` synchronously, CALLS server.close() on all three listeners WITHOUT awaiting their callbacks (in
 *            Node a listener's close callback fires only after its active connections end), unlinks the three sockets and
 *            writes seal-ack. From the `sealed = true` statement on, no handler opens an upstream connection; that is all the
 *            ack claims. It does NOT claim drain.
 *   close(): seals (if not yet), destroys every remaining client and upstream socket, THEN waits (bounded) for the listener
 *            close callbacks, and writes bridge-final with accepted/refused/open-at-close per socket and LISTENERS CLOSED or
 *            LISTENERS UNRESOLVED. Nothing here is claimed for work begun upstream through a destroyed connection.
 */
export function createBridge(deps, { sockDir, ctl, ports }) {
  for (const k of SOCKETS) if (!Number.isInteger(ports?.[k]) || ports[k] < 1 || ports[k] > 65535) throw new Error('bridge: ports');
  if (typeof deps?.hold !== 'function' || typeof deps?.exit !== 'function') throw new Error('bridge: lifetime deps');
  let sealed = false, sealing = null, closing = null, life = null, closeBy = null;
  const servers = new Map();
  const closed = new Map(); // listener name -> promise resolved by its close callback
  const stats = Object.fromEntries(SOCKETS.map((k) => [k, { accepted: 0, refusedAfterSeal: 0, open: new Set() }]));
  const handler = (name) => (client) => {
    // FIRST statement: a sealed bridge never opens an upstream connection, including for accepts the kernel had queued.
    if (sealed) { stats[name].refusedAfterSeal++; client.destroy(); return; }
    const s = stats[name];
    s.accepted++;
    const up = deps.net.connect({ host: '127.0.0.1', port: ports[name] });
    const pair = { client, up };
    s.open.add(pair);
    const end = () => { client.destroy(); up.destroy(); s.open.delete(pair); };
    client.on('error', end); up.on('error', end); client.on('close', end); up.on('close', end);
    client.pipe(up); up.pipe(client);
  };
  const listen = async () => {
    life ??= deps.hold(); // referenced from the start; released only after bridge-final (close, finally)
    for (const k of SOCKETS) {
      const srv = deps.net.createServer(handler(k));
      servers.set(k, srv);
      await new Promise((resolve, reject) => { srv.once('error', reject); srv.listen(path.join(sockDir, `${k}.sock`), () => { srv.off('error', reject); resolve(); }); });
    }
    deps.files.put(path.join(ctl, 'bridge-ready'), `${deps.pid} ${deps.starttime} ${ports.api} ${ports.db} ${ports.app}\n`);
  };
  const seal = () => {
    if (sealing) return sealing;
    sealed = true; // synchronously, before anything else
    // Bounded post-seal lifetime: without an owner SIGTERM in time, close ourselves, record CEILING and exit non-zero.
    deps.sleep(SEALED_HOLD_MAX_MS).then(() => { if (!closing) close('CEILING').finally(() => deps.exit(4)); });
    sealing = (async () => {
      // Initiate (never await) each listener close: its callback waits for active connections, which only close() destroys.
      for (const [k, srv] of servers) closed.set(k, new Promise((r) => { try { srv.close(() => r(true)); } catch { r(false); } }));
      for (const k of SOCKETS) { try { deps.files.unlink(path.join(sockDir, `${k}.sock`)); } catch { /* already gone */ } }
      deps.files.put(path.join(ctl, 'seal-ack'), 'sealed\n');
    })();
    return sealing;
  };
  const finalize = async () => {
    let sealOk = true;
    await seal().catch(() => { sealOk = false; });
    const openAtClose = Object.fromEntries(SOCKETS.map((k) => [k, stats[k].open.size]));
    for (const k of SOCKETS) for (const p of [...stats[k].open]) { p.client.destroy(); p.up.destroy(); stats[k].open.delete(p); }
    // Only now can the listener close callbacks fire. Bounded; a timeout is recorded, never treated as closed.
    const all = Promise.all([...closed.values()]).then((v) => v.length === servers.size && v.every(Boolean));
    const listenersClosed = await Promise.race([all, deps.sleep(LISTENER_CLOSE_MS).then(() => false)]);
    deps.files.put(path.join(ctl, 'bridge-final'),
      `${SOCKETS.map((k) => `${k} accepted=${stats[k].accepted} refused=${stats[k].refusedAfterSeal} open=${openAtClose[k]}`).join('\n')}\n`
      + `LISTENERS ${sealOk && listenersClosed ? 'CLOSED' : 'UNRESOLVED'}\nCLOSE ${closeBy}\nEND\n`);
  };
  const close = (by = 'OWNER') => {
    if (closing) return closing;
    closeBy = by;
    closing = (async () => {
      try { await finalize(); } finally {
        // Released only now, after the final receipt (or its failure): the process may then exit or be exited by its handler.
        try { life?.release(); } catch { /* the handler's exit follows */ }
        life = null;
      }
    })();
    return closing;
  };
  return { listen, seal, close: () => close('OWNER'), stats, isSealed: () => sealed, holding: () => life !== null };
}

/** Parse bridge-final: the three socket lines in order, LISTENERS CLOSED|UNRESOLVED, CLOSE OWNER|CEILING, then END. null otherwise. */
export function parseBridgeFinal(text) {
  if (typeof text !== 'string') return null;
  const ls = text.split('\n');
  if (ls.length !== SOCKETS.length + 4 || ls.at(-2) !== 'END' || ls.at(-1) !== '') return null;
  const out = {};
  for (let i = 0; i < SOCKETS.length; i++) {
    const m = /^([a-z]+) accepted=(\d+) refused=(\d+) open=(\d+)$/.exec(ls[i]);
    if (!m || m[1] !== SOCKETS[i]) return null;
    out[m[1]] = { accepted: Number(m[2]), refused: Number(m[3]), open: Number(m[4]) };
  }
  const l = /^LISTENERS (CLOSED|UNRESOLVED)$/.exec(ls[SOCKETS.length]);
  if (!l) return null;
  out.listeners = l[1];
  const c = /^CLOSE (OWNER|CEILING)$/.exec(ls[SOCKETS.length + 1]);
  if (!c) return null;
  out.closeBy = c[1];
  return out;
}

if (process.argv[1] && /le-lane\/bridge\.mjs$/.test(process.argv[1])) {
  process.umask(0o077);
  const [sockDir, ctl, a, d, p] = process.argv.slice(2);
  const stat = fs.readFileSync(`/proc/${process.pid}/stat`, 'utf8');
  const starttime = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
  const files = { put: (f, t) => fs.writeFileSync(f, t, { flag: 'wx', mode: 0o600 }), unlink: (f) => fs.unlinkSync(f) };
  const sleep = (ms) => new Promise((r) => { setTimeout(r, ms).unref(); });
  // The ONE referenced handle (never unref'd): keeps the process alive from listen until close has written bridge-final.
  const hold = () => { const t = setInterval(() => {}, 1 << 30); return { release: () => clearInterval(t) }; };
  const exit = (code) => process.exit(code);
  const b = createBridge({ net, files, pid: process.pid, starttime, sleep, hold, exit }, { sockDir, ctl, ports: { api: Number(a), db: Number(d), app: Number(p) } });
  process.on('SIGUSR2', () => { b.seal().catch(() => process.exit(3)); });
  process.on('SIGTERM', () => { b.close().then(() => process.exit(0), () => process.exit(3)); });
  b.listen().catch(() => process.exit(2));
}
