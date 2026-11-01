#!/usr/bin/env node
// ABOUTME: Owns the per-mode Docker network for the t09 local stack: create it with loopback-only default host binding
// ABOUTME: (the Supabase CLI's documented `--network-id` method), verify options and membership, check effective
// ABOUTME: listeners, and remove ONLY the network this job created. No daemon, default, firewall or privilege change.
//
// Usage: stack-net.mjs create  <name> <owner>   refuse Docker < 28, an existing name, or any option drift after create
//        stack-net.mjs verify  <name> <owner>   network options exact; every supabase_* container is on it and only it
//        stack-net.mjs listeners                every host listener on 54320-54324 is loopback; 54321 and 54322 present
//        stack-net.mjs remove  <name> <owner>   remove only if our owner label matches; then prove it is gone
// <name> is ic-t09-<old|new>-net-<run id>-<attempt>; <owner> is a job-unique label value (run id, attempt, mode).
//
// Docker < 28 is refused: Docker's port-publishing docs state that in releases older than 28.0.0, hosts within the same
// L2 segment can reach ports published to localhost (moby/moby#45610), so a loopback binding there would not mean
// loopback-only exposure. IPv6: no documented host_binding_ipv6 default applies here, so the unchanged ports check and
// the listeners check below are what prove there is no [::] exposure; nothing assumes it. This script makes no claim about the runner's egress or other interfaces.
import { execFileSync } from 'node:child_process';

const OPT = 'com.docker.network.bridge.host_binding_ipv4';
const LABEL = 'ic.t09.owner';
const NAMES = /^ic-t09-(old|new)-net-[0-9]{1,20}-[0-9]{1,4}$/;   // mode + run id + attempt: unique per run
const fail = (m) => { console.log(`FAIL net: ${m}`); process.exit(1); };
// Any unexpected exception ends in a controlled, content-free line: never an Error message or stack, which could carry
// untrusted output (a child's stderr, a JSON fragment). The exit stays non-zero.
process.on('uncaughtException', (e) => { console.log(`FAIL net: unexpected ${e?.constructor?.name ?? 'error'} (detail withheld)`); process.exit(1); });
const refuse = (m) => { console.log(`REFUSED net: ${m}`); process.exit(2); };
// Every child runs with stdout AND stderr captured; stderr is never printed, only its byte count. A failed child (non-zero
// exit, signal, missing binary, daemon or socket unavailable) is ALWAYS a failure: no caller can turn it into "absent".
function run(bin, args) {
  try { return execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 << 20 }); }
  catch (e) {
    const why = e?.code === 'ENOENT' ? 'not found' : e?.signal ? `signal ${e.signal}` : `exit ${e?.status ?? '?'}`;
    fail(`${bin} ${args[0]} ${args[1] ?? ''} failed (${why}; stderr withheld: ${Buffer.byteLength(String(e?.stderr ?? ''))} bytes)`);
  }
}
const docker = (args) => run('docker', args).trim();
const parse = (text, what) => { try { return JSON.parse(text); } catch { fail(`${what}: unparseable output (withheld)`); } };
// Presence comes ONLY from a successful exact-name listing: success + no line = absent; success + the name = present;
// anything else (listing failed, an unexpected line) fails closed.
function present(name) {
  const lines = docker(['network', 'ls', '--filter', `name=^${name}$`, '--format', '{{.Name}}']).split('\n').filter(Boolean);
  if (lines.length === 0) return false;
  if (lines.length === 1 && lines[0] === name) return true;
  fail(`network listing for ${name} returned ${lines.length} unexpected line(s)`);
}
// Inspect only something the listing showed present; a failed inspect is a failure, never "absent".
function inspect(name) {
  if (!present(name)) return null;
  return parse(docker(['network', 'inspect', name, '--format', '{{json .}}']), `inspect ${name}`);
}
function checkNetwork(net, name, owner) {
  if (!net) fail(`${name} does not exist`);
  if (net.Name !== name) fail(`inspect returned '${net.Name}' for ${name}`);
  if (net.Driver !== 'bridge') fail(`${name} driver is '${net.Driver}', expected bridge`);
  const opts = net.Options ?? {};
  const keys = Object.keys(opts).sort();
  if (keys.length !== 1 || keys[0] !== OPT || opts[OPT] !== '127.0.0.1') fail(`${name} options are ${JSON.stringify(opts)}, expected exactly {"${OPT}":"127.0.0.1"}`);
  if ((net.Labels ?? {})[LABEL] !== owner) fail(`${name} is not owned by this job (label ${LABEL} mismatch)`);
}
function engineVersion() {
  const v = docker(['version', '--format', '{{.Server.Version}}']);
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) fail(`unparseable Docker Engine version '${v}'`);
  console.log(`docker engine ${m[0]}`);
  if (Number(m[1]) < 28) refuse(`Docker Engine ${m[0]} < 28: before 28.0.0 hosts on the same L2 segment can reach ports published to localhost`);
  return m[0];
}

const [cmd, name, owner] = process.argv.slice(2);
if (['create', 'verify', 'remove'].includes(cmd)) {
  if (!NAMES.test(name ?? '')) refuse(`network name '${name}' is not ic-t09-<old|new>-net-<run id>-<attempt>`);
  if (!/^[A-Za-z0-9._-]{3,80}$/.test(owner ?? '')) refuse('owner label missing or not [A-Za-z0-9._-]{3,80}');
}
switch (cmd) {
  case 'create': {
    engineVersion();
    if (inspect(name)) refuse(`${name} already exists; an existing network is never adopted`);
    docker(['network', 'create', '--driver', 'bridge', '--label', `${LABEL}=${owner}`, '-o', `${OPT}=127.0.0.1`, name]);
    checkNetwork(inspect(name), name, owner);
    console.log(`PASS net create: ${name} bridge, ${OPT}=127.0.0.1 only, owned by this job`);
    break;
  }
  case 'verify': {
    engineVersion();
    checkNetwork(inspect(name), name, owner);
    const containers = docker(['ps', '--format', '{{.Names}}']).split('\n').filter((n) => /^supabase_/.test(n));
    if (containers.length === 0) fail('no supabase_* container is running');
    for (const c of containers) {
      const nets = Object.keys(parse(docker(['inspect', c, '--format', '{{json .NetworkSettings.Networks}}']), 'container networks') ?? {});
      if (nets.length !== 1 || nets[0] !== name) fail(`a stack container is attached to [${nets.length} network(s)], expected only ${name}`);
    }
    const members = Object.keys(inspect(name).Containers ?? {}).length;
    if (members !== containers.length) fail(`${name} has ${members} member(s) but ${containers.length} stack container(s) run`);
    console.log(`PASS net verify: ${containers.length} stack containers, each only on ${name}; options exact`);
    break;
  }
  case 'listeners': {
    const ss = run('ss', ['-ltnH']);
    const seen = new Map(); let bad = 0;
    for (const line of ss.split('\n').filter(Boolean)) {
      const local = line.trim().split(/\s+/)[3] ?? '';
      const i = local.lastIndexOf(':'); const addr = local.slice(0, i); const port = local.slice(i + 1);
      if (!/^5432[0-4]$/.test(port)) continue;
      const loop = ['127.0.0.1', '[::1]', '::1'].includes(addr) || /^127\./.test(addr);
      if (!loop) { console.log(`BLOCKER listeners: ${port} listens on '${addr}' (not loopback)`); bad = 1; }
      else seen.set(port, (seen.get(port) ?? 0) + 1);
    }
    if (bad) fail('a non-loopback host listener exists on 54320-54324 (no network setting is changed to pass)');
    for (const p of ['54321', '54322']) if (!seen.get(p)) fail(`no loopback listener on ${p}: the check would be vacuous`);
    console.log(`PASS listeners: ${[...seen].map(([p, n]) => `${p}x${n}`).join(' ')} all loopback`);
    break;
  }
  case 'remove': {
    const net = inspect(name);
    if (!net) { console.log(`PASS net remove: ${name} absent (never created or already removed)`); break; }
    if ((net.Labels ?? {})[LABEL] !== owner) refuse(`${name} exists but is not owned by this job; it is left untouched`);
    docker(['network', 'rm', name]);                  // a failed rm fails here (run), never reaches the absence check
    if (present(name)) fail(`${name} still present after rm`);
    console.log(`PASS net remove: ${name} removed and verified absent`);
    break;
  }
  default: refuse('usage: stack-net.mjs create|verify|remove <name> <owner> | listeners');
}
