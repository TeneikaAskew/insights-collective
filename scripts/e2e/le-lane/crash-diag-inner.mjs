#!/usr/bin/env node
// ABOUTME: Diagnostic only (dispatch job lesson-editor-crash-diag): launches the pinned headless shell the way the sealed lane
// ABOUTME: does, drives the synthetic /blank and /doc dummy pages, and prints each step's outcome plus the browser's own stderr.
//
//   crash-diag-inner.mjs <headless shell abs path> <variant label> [extra chromium arg ...]
//
// Dummy pages only (the lifecycle matrix's fixed bodies on 127.0.0.1); no app, stack, credential or fixture exists here.
import http from 'node:http';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { RESOLVER_ARG } from '../../../e2e/lesson-editor/sandbox-launch.mjs';
import { DUMMY_BODIES, dummyHandler } from '../../../e2e/lesson-editor/lifecycle-matrix.mjs';

const [shell, variant = 'UNNAMED', ...extra] = process.argv.slice(2);
const out = (s) => process.stdout.write(`DIAG ${variant} ${s}\n`);
const MAX_LINES = 400;
const lines = [];
let pending = '';
const keep = (chunk) => {
  pending += chunk.toString('utf8');
  const parts = pending.split('\n');
  pending = parts.pop() ?? '';
  for (const l of parts) if (lines.length < MAX_LINES) lines.push(l.slice(0, 600));
};
const bounded = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out after ${ms} ms`)), ms))]);

async function main() {
  for (const p of ['/etc/fonts/fonts.conf', '/usr/share/fonts', '/dev/shm']) out(`FS ${p} ${fs.existsSync(p) ? 'PRESENT' : 'ABSENT'}`);
  const server = http.createServer(dummyHandler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  out(`DUMMY ${origin} paths=${Object.keys(DUMMY_BODIES).join(',')}`);
  let bs = null, browser = null, exit = 'NONE', crashed = false;
  try {
    bs = await bounded(chromium.launchServer({ executablePath: shell, args: [RESOLVER_ARG, ...extra], env: { HOME: '/tmp', TMPDIR: '/tmp' },
      host: '127.0.0.1', port: 0, chromiumSandbox: true, headless: true }), 60_000, 'launchServer');
    const proc = bs.process();
    proc.stderr?.on('data', keep);
    proc.on('exit', (code, sig) => { exit = sig ?? `CODE_${code}`; out(`BROWSER_EXIT ${exit}`); });
    out(`LAUNCH OK pid=${proc.pid} argv_has_no_sandbox=${fs.readFileSync(`/proc/${proc.pid}/cmdline`, 'latin1').split('\0').includes('--no-sandbox')}`);
    browser = await bounded(chromium.connect(bs.wsEndpoint()), 15_000, 'connect');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', serviceWorkers: 'block' });
    context.setDefaultTimeout(30_000);
    const step = async (name, fn) => {
      const t0 = Date.now();
      try { await fn(); out(`STEP ${name} OK ${Date.now() - t0}ms`); return true; }
      catch (e) { out(`STEP ${name} FAIL ${Date.now() - t0}ms ${String(e?.message ?? e).split('\n')[0].slice(0, 300)}`); return false; }
    };
    const page = await context.newPage();
    page.on('crash', () => { crashed = true; out('PAGE_CRASH'); });
    (await step('goto_blank', () => page.goto(`${origin}/blank`)))
      && (await step('goto_doc', () => page.goto(`${origin}/doc`)))
      && (await step('visible_t', () => page.locator('#t').waitFor({ state: 'visible' })))
      && (await step('visible_b', () => page.locator('#b').waitFor({ state: 'visible' })))
      && (await step('click_b', () => page.locator('#b').click()))
      && (await step('type', () => page.keyboard.type('abc')))
      && (await step('read_back', async () => { const v = await page.locator('#b').textContent(); if (v !== 'abc') throw new Error(`read back ${JSON.stringify(v)}`); }));
    await step('settle_2s', () => new Promise((r) => setTimeout(r, 2000)));
    await step('context_close', () => context.close());
  } catch (e) {
    out(`ERROR ${String(e?.message ?? e).split('\n')[0].slice(0, 300)}`);
  } finally {
    try { await bounded(browser?.close() ?? Promise.resolve(), 10_000, 'browser close'); } catch { /* the server close ends it */ }
    try { await bounded(bs?.close() ?? Promise.resolve(), 10_000, 'server close'); } catch { /* container exit ends it */ }
    server.close();
    if (pending && lines.length < MAX_LINES) lines.push(pending.slice(0, 600));
    out(`SUMMARY exit=${exit} page_crash=${crashed} stderr_lines=${lines.length}`);
    for (const l of lines) out(`STDERR ${l}`);
  }
}
main().then(() => process.exit(0), (e) => { out(`FATAL ${e?.message ?? e}`); process.exit(1); });
