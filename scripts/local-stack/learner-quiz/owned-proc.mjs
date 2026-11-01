#!/usr/bin/env node
// ABOUTME: Starts background servers as OWNED process groups, proven by a launch handshake, and stops only processes whose ownership
// ABOUTME: is proven from /proc; every inspection failure is an error, never "absent". Replaces owned-proc.sh and any pattern kill.
//
//   owned-proc.mjs start <state dir> <name> <log file> -- <command...>
//     Spawns the command detached (setsid: new session and group). BEFORE writing the ownership record, the handshake reads
//     /proc/<pid>/stat and requires pgid == sid == pid and a starttime. The record "<pid> <starttime> <pgid> <sid>" is written to
//     <name>.own.tmp, read back, then renamed. If the handshake fails, nothing is recorded and nothing is signalled (the child was
//     not verified). If the record write or read-back fails after a verified handshake, the verified child's group is rolled back
//     (SIGKILL, re-verified first) and the command exits 3.
//   owned-proc.mjs stop <state dir> <port>...
//     For each record:
//     - leader alive with the recorded starttime: SIGTERM the group, wait, then SIGKILL; wait for no live member.
//     - leader alive with a different starttime (pid reused): not signalled.
//     - leader gone (stat ENOENT): members with pgid == recorded pgid are signalled one by one, and ONLY if every such member has
//       sid == recorded sid and starttime >= recorded starttime. Any other member of that pgid means REFUSED (exit 1), nothing sent.
//     Then each port must have no TCP listener (ss).
// /proc enumeration failure, a stat read failing with anything but ENOENT/ESRCH, an unparsable stat, or an ss failure is an
// INSPECTION ERROR (exit 3). Zombies count as gone. Exit: 0 ok; 1 group alive, refused, or listener present; 2 usage; 3 inspection.
// Test-only: OWNED_PROC_PROC_ROOT replaces /proc for reads (fault injection); signals still go to real pids, so tests use fake pids
// that do not exist or are refused before any signal.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PROC = process.env.OWNED_PROC_PROC_ROOT || '/proc';
class E extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const out = (m) => console.log(`OWNED-PROC ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Parsed stat for a pid, null if the process verifiably does not exist (ENOENT/ESRCH), throws E(3) on any other failure. */
export function stat(pid) {
  let s;
  try { s = fs.readFileSync(path.join(PROC, String(pid), 'stat'), 'utf8'); } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ESRCH') return null;
    throw new E(3, `cannot read stat for pid ${pid} (${e.code ?? 'error'})`);
  }
  const close = s.lastIndexOf(')');
  const f = close > 0 ? s.slice(close + 2).trim().split(/\s+/) : [];
  // After "pid (comm) ": f[0]=state, f[2]=pgrp, f[3]=session, f[19]=starttime.
  if (f.length < 20 || !/^\d+$/.test(f[2]) || !/^\d+$/.test(f[3]) || !/^\d+$/.test(f[19])) throw new E(3, `unparsable stat for pid ${pid}`);
  return { state: f[0], pgid: Number(f[2]), sid: Number(f[3]), start: f[19] };
}
const live = (st) => st !== null && st.state !== 'Z';

/** Every live process in the group, with its stat. Enumeration failure throws E(3); a pid vanishing mid-scan is skipped. */
export function members(pgid) {
  let names;
  try { names = fs.readdirSync(PROC); } catch (e) { throw new E(3, `cannot enumerate ${PROC} (${e.code ?? 'error'})`); }
  const res = [];
  for (const n of names) {
    if (!/^\d+$/.test(n)) continue;
    const st = stat(Number(n));
    if (live(st) && st.pgid === pgid) res.push({ pid: Number(n), ...st });
  }
  return res;
}

function readRecord(file) {
  let t;
  try { t = fs.readFileSync(file, 'utf8'); } catch (e) { throw new E(3, `unreadable record ${path.basename(file)}`); }
  const m = t.match(/^(\d+) (\d+) (\d+) (\d+)\n$/);
  if (!m) throw new E(3, `malformed record ${path.basename(file)}`);
  return { pid: Number(m[1]), start: m[2], pgid: Number(m[3]), sid: Number(m[4]) };
}

async function start(dir, name, log, cmd) {
  if (!/^[a-z][a-z0-9-]{0,30}$/.test(name)) throw new E(2, 'bad name');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { throw new E(3, 'state dir not writable'); }
  const rec = path.join(dir, `${name}.own`);
  if (fs.existsSync(rec)) throw new E(2, `record ${name} already exists`);
  let fd;
  try { fd = fs.openSync(log, 'a', 0o600); } catch { throw new E(3, 'cannot open log'); }
  const child = spawn(cmd[0], cmd.slice(1), { detached: true, stdio: ['ignore', fd, fd] });
  let spawnError = null;
  child.on('error', (e) => { spawnError = e; });
  const pid = child.pid;
  if (!pid || spawnError) throw new E(3, 'spawn failed; nothing recorded, nothing signalled');
  child.unref();
  // Handshake: the child must be its own session and group leader.
  let st = null;
  for (let i = 0; i < 20 && !(st && st.pgid === pid && st.sid === pid); i++) { st = stat(pid); if (st === null) break; await sleep(25); }
  if (!(live(st) && st.pgid === pid && st.sid === pid)) {
    throw new E(3, `launch handshake failed for ${name} (process not verified as its own session/group leader); nothing recorded, nothing signalled`);
  }
  const line = `${pid} ${st.start} ${pid} ${pid}\n`;
  try {
    if (process.env.OWNED_PROC_FAIL_RECORD_WRITE === '1') throw new Error('injected');  // test-only fault injection
    fs.writeFileSync(`${rec}.tmp`, line, { mode: 0o600, flag: 'wx' });
    if (fs.readFileSync(`${rec}.tmp`, 'utf8') !== line) throw new Error('read-back mismatch');
    fs.renameSync(`${rec}.tmp`, rec);
  } catch {
    try { fs.rmSync(`${rec}.tmp`, { force: true }); } catch { /* reported below */ }
    const again = stat(pid);
    if (live(again) && again.start === st.start && again.pgid === pid) { try { process.kill(-pid, 'SIGKILL'); } catch { /* gone */ } out(`${name}: record write failed; verified child group rolled back`); }
    else out(`${name}: record write failed; child no longer verifiable, not signalled`);
    throw new E(3, 'record write failed');
  }
  out(`started ${name} (handshake verified: own session and group; record written)`);
}

async function waitGone(pgid, ms) { for (let t = 0; t < ms; t += 250) { if (members(pgid).length === 0) return true; await sleep(250); } return members(pgid).length === 0; }

async function stopOne(file) {
  const name = path.basename(file, '.own');
  const r = readRecord(file);
  const lead = stat(r.pid);
  if (lead !== null && lead.start !== r.start) { out(`${name}: pid reused by another process; not signalled`); return 0; }
  if (live(lead)) {
    try { process.kill(-r.pgid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw new E(3, `signal failed (${e.code})`); }
    if (!(await waitGone(r.pgid, 20000))) {
      // Re-prove ownership before escalation: the leader must still be ours, or every remaining member must be.
      const l2 = stat(r.pid);
      const ms = members(r.pgid);
      const ours = (live(l2) && l2.start === r.start) || ms.every((m) => m.sid === r.sid && BigInt(m.start) >= BigInt(r.start));
      if (!ours) { out(`${name}: group membership changed and ownership is not provable; not escalated`); return 1; }
      try { process.kill(-r.pgid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw new E(3, `signal failed (${e.code})`); }
      await waitGone(r.pgid, 5000);
    }
  } else {
    const ms = members(r.pgid);
    if (ms.length === 0) { out(`${name}: already exited`); return 0; }
    const foreign = ms.filter((m) => m.sid !== r.sid || BigInt(m.start) < BigInt(r.start));
    if (foreign.length) { out(`${name}: leader gone and ${foreign.length} member(s) of that group are not provably ours; REFUSED, nothing signalled`); return 1; }
    for (const m of ms) {
      const again = stat(m.pid);
      if (live(again) && again.start === m.start && again.sid === r.sid) { try { process.kill(m.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw new E(3, `signal failed (${e.code})`); } }
    }
    await waitGone(r.pgid, 5000);
  }
  if (members(r.pgid).length) { out(`${name}: process group still alive`); return 1; }
  out(`${name}: owned group stopped`);
  return 0;
}

async function stop(dir, ports) {
  let fail = 0;
  let files = [];
  if (fs.existsSync(dir)) {
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.own')).sort().map((f) => path.join(dir, f)); }
    catch { throw new E(3, 'cannot list state dir'); }
  }
  for (const f of files) fail |= await stopOne(f);
  for (const p of ports) {
    if (!/^\d{1,5}$/.test(p)) throw new E(2, 'bad port');
    let o;
    try { o = execFileSync('ss', ['-Hltn', `sport = :${p}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { throw new E(3, `ss failed for port ${p}`); }
    if (o.trim()) { out(`port ${p}: a listener is still present`); fail = 1; } else out(`port ${p}: no listener`);
  }
  return fail;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const a = process.argv.slice(2);
  try {
    if (a[0] === 'start') {
      if (a.length < 6 || a[4] !== '--') throw new E(2, 'usage: start <state dir> <name> <log> -- <command...>');
      await start(a[1], a[2], a[3], a.slice(5));
      process.exit(0);
    } else if (a[0] === 'stop') {
      if (a.length < 3) throw new E(2, 'usage: stop <state dir> <port>...');
      process.exit(await stop(a[1], a.slice(2)));
    } else throw new E(2, 'usage: owned-proc.mjs start|stop ...');
  } catch (e) {
    out(e instanceof E ? e.message : 'unexpected error');
    process.exit(e instanceof E ? e.code : 3);
  }
}
