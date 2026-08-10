#!/usr/bin/env node
// ABOUTME: Starts the Supabase relay and the dev server wired to it, as one process.
// ABOUTME: What playwright.config.ts runs as its webServer when E2E_USE_RELAY=1.
//
// Two processes have to come up in order — the relay first, because the dev
// server needs its URL baked into VITE_SUPABASE_URL — and Playwright's webServer
// option takes a single command. This is that command.
//
// Only needed where the browser cannot reach the project directly. CI does not
// set E2E_USE_RELAY, so it runs the dev server on its own and nothing here
// executes. See scripts/e2e/supabase-relay.mjs for why the relay exists.

import { spawn } from 'node:child_process';

const RELAY_PORT = process.env.E2E_RELAY_PORT ?? '54399';
const APP_PORT = process.env.E2E_APP_PORT ?? '8080';
const children = [];

function run(label, command, args, env) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  // Prefix so two interleaved logs are still readable.
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (d) => process.stderr.write(`[${label}] ${d}`));
  }
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${label}] exited with ${code}`);
      shutdown(code);
    }
  });
  return child;
}

function shutdown(code = 0) {
  for (const c of children) c.kill('SIGTERM');
  process.exit(code);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(0));

/**
 * Address the relay as `localhost`, not `127.0.0.1`.
 *
 * playwright.config.ts blocks external hosts with
 * `--host-resolver-rules=MAP * 127.0.0.1:1,EXCLUDE localhost`. Chromium applies
 * `MAP *` to IP literals as well as hostnames, so `http://127.0.0.1:54399` is
 * remapped to port 1 and every Supabase call dies with ERR_CONNECTION_REFUSED —
 * while the pages still render, so the suite goes green against an app with no
 * data. `localhost` is the excluded name, so it is the one that survives.
 */
const relayUrl = `http://localhost:${RELAY_PORT}`;

async function relayIsUp() {
  try {
    await fetch(`${relayUrl}/rest/v1/`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

// Reuse a relay that is already listening, the same way Playwright's
// reuseExistingServer works. Otherwise a leftover relay from a previous run
// makes the whole suite fail to start with EADDRINUSE, which reads as a broken
// test setup rather than "something is already running".
if (await relayIsUp()) {
  console.error(`reusing relay already listening on ${relayUrl}`);
} else {
  run('relay', 'node', ['scripts/e2e/supabase-relay.mjs', '--port', RELAY_PORT]);

  // Poll rather than sleeping a fixed amount: vite reads VITE_SUPABASE_URL at
  // startup, so a dev server that starts first still points at the right place,
  // but a relay that is not listening yet turns the first page load into a
  // confusing 502.
  const deadline = Date.now() + 20_000;
  while (!(await relayIsUp())) {
    if (Date.now() > deadline) {
      console.error(`relay did not come up on ${relayUrl} within 20s`);
      shutdown(1);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.error(`relay ready on ${relayUrl}`);
}

// --strictPort, not vite's default "try the next one": a silent bump left the
// suite pointed at whatever already owned APP_PORT (a sandbox dev server wired
// to the real project, unreachable under the hermetic host-resolver rule) while
// this relay-backed server sat unused on APP_PORT+1. Fail instead.
run('vite', 'npx', ['vite', '--host', '127.0.0.1', '--port', APP_PORT, '--strictPort'], {
  VITE_SUPABASE_URL: relayUrl,
});

