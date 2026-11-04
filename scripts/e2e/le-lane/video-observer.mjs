// ABOUTME: Pure detection logic of the sealed video fixture (e2e/stubbed/sandboxed-test.ts): the worker ledger, the request and
// ABOUTME: WebSocket observer kept attached through the owned context's closure, and the layout-only text-render precheck.
//
// SOURCE CANDIDATE (sealed-video r1, correction c1). UNRUN. This module writes nothing and imports no Playwright: the fixture
// passes real Playwright objects in, and src/test/ci/checkSealedVideoLane.test.ts passes fakes. The fixture keeps the only
// writers (the .start and .end records).
//
// Lifecycle contract (detection, not prevention):
//   - attachObserver() never detaches. The listeners live as long as the context, so a request or WebSocket that happens
//     during Playwright's own context teardown (after the observer fixture has finished) still lands in the WORKER ledger.
//   - The per-test assertion covers what was seen up to the observer's teardown; anything later is counted only in the ledger,
//     and any refusal there fails the lane (aggregateEgress: refused > 0).
//   - The ledger's `closed` becomes true only when the owned browser and its server were closed WITHOUT a cleanup mark
//     (withSandboxedBrowser returned normally). A launch failure, a thrown cleanup or a precheck failure leaves it false, and the
//     lane fails with LANE_E_EGRESS_OPEN.
//   - The ledger is sealed just before the .end record is written, which is after the owned browser closed (the browser
//     fixture depends on the ledger, so Playwright tears it down first). A note after sealing cannot reach the record; it is
//     counted in `late` only. That window has no remaining event source, which is a stated assumption, not a proof.
//   - Any observer callback that cannot read the request (method() or url() throws) is counted as a refusal, never skipped.
import { MAX_REFUSED_LINES, refusedLine } from './egress-records.mjs';

export const OBSERVED_METHODS = Object.freeze(['GET', 'HEAD']);

/** A fresh worker ledger. `note` keeps the exact count and at most MAX_REFUSED_LINES closed lines. */
export function createLedger() {
  return {
    refused: 0, tests: 0, lines: [], closed: false, sealed: false, late: 0,
    note(reason, method, url) {
      if (this.sealed) { this.late++; return; }
      this.refused++;
      if (this.lines.length < MAX_REFUSED_LINES) this.lines.push(safeLine(reason, method, url));
    },
  };
}

/** A closed REFUSED line for any input; unreadable parts reduce to '-' and `<opaque>` rather than throwing. */
export function safeLine(reason, method, url) {
  try { return refusedLine(reason, method, typeof url === 'string' ? url : ''); } catch { return refusedLine(reason, '-', ''); }
}

const read = (f) => { try { const v = f(); return typeof v === 'string' ? v : null; } catch { return null; } };

/**
 * Attach the observer to a context: every request whose method is not GET or HEAD (or cannot be read), and every WebSocket on
 * any page of the context (existing or later), is noted in the ledger and in the returned `seen` list. Never detached.
 */
export function attachObserver(context, ledger) {
  const seen = [];
  const refuse = (reason, method, url) => { ledger.note(reason, method, url); seen.push(safeLine(reason, method, url)); };
  const onRequest = (r) => {
    const m = read(() => r.method());
    if (m === null || !OBSERVED_METHODS.includes(m)) refuse('method', m ?? '-', read(() => r.url()) ?? '');
  };
  const onWs = (ws) => { refuse('websocket', '-', read(() => ws.url()) ?? ''); };
  const watch = (p) => { p.on('websocket', onWs); };
  context.on('request', onRequest);
  context.on('page', watch);
  for (const p of context.pages()) watch(p);
  return { seen, listeners: { onRequest, onWs, watch } };
}

/** The observer fixture's body: count the test, attach, run it, return the per-test snapshot. The listeners stay attached. */
export async function observeTest(context, ledger, use) {
  ledger.tests++;
  const obs = attachObserver(context, ledger);
  await use();
  return obs.seen.slice();
}

/**
 * The worker browser's body: the text-render precheck, then the tests. `run` is withSandboxedBrowser bound to its options; it
 * returns normally only when the browser and server closed without a cleanup mark, and only then is the ledger marked closed.
 */
export async function runWorkerBrowser(run, ledger, use) {
  await run(async (browser) => {
    await textRenderPrecheck(browser, ledger);
    await use(browser);
  });
  ledger.closed = true;
}

/** Seal the ledger and return the .end fields. Closed only when the browser closed cleanly and nothing arrived after sealing. */
export function finalLedger(ledger) {
  ledger.sealed = true;
  return { refused: ledger.refused, forwarded: 0, tests: ledger.tests, closed: ledger.closed === true && ledger.late === 0, lines: ledger.lines.slice() };
}

// Layout-only text-render precheck (DESIGN r2 section 8). One fixed inline page, every route aborted, observed by the same
// ledger. It proves ONLY that the infrastructure lays out a text node with a positive box. It does NOT prove glyphs, font
// metrics, wrapping or visual fidelity, and it fetches nothing (the image ships no fonts).
export const TEXT_RENDER_HTML = '<!doctype html><meta charset="utf-8"><p id="sealed-text" style="margin:0;font-size:16px">Sealed text render</p>';
export const TEXT_RENDER_OK = 'LANE_TEXT_RENDER_OK';
export const TEXT_RENDER_E = 'LANE_E_TEXT_RENDER';

/** A positive, finite box is OK; anything else is LANE_E_TEXT_RENDER. */
export function textRenderCode(box) {
  const ok = box && [box.width, box.height].every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0);
  return ok ? TEXT_RENDER_OK : TEXT_RENDER_E;
}

export async function textRenderPrecheck(browser, ledger) {
  let context = null;
  let code = TEXT_RENDER_E;
  try {
    context = await browser.newContext({ serviceWorkers: 'block' });
    attachObserver(context, ledger);
    await context.route('**/*', (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(TEXT_RENDER_HTML, { waitUntil: 'load' });
    code = textRenderCode(await page.locator('#sealed-text').boundingBox());
  } catch { code = TEXT_RENDER_E; } finally {
    if (context) { try { await context.close(); } catch { code = TEXT_RENDER_E; } }
  }
  if (code !== TEXT_RENDER_OK) throw new Error(TEXT_RENDER_E);
  return code;
}
