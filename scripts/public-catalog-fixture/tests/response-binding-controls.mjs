#!/usr/bin/env node
// ABOUTME: Deterministic OLD/NEW controls for response binding: fake Playwright context/page emitters driven by real callbacks,
// ABOUTME: so the 4bdb4c5e drain race (PASS returned, then unbound=1 afterwards) and every refusal path replay exactly.
//
// OLD arm: the 4bdb4c5e support.ts logic verbatim in shape (page-only 'response' listener, Promise.all(bindings) over a list
// that keeps growing, no in-flight tracking, no bound, no detach). NEW arm: createResponseBinder from response-binding.mjs
// on the CONTEXT, freeze(bound). Verdicts: PASS, UNBOUND, FAILED, REFUSE_INCOMPLETE, HANG. Prints one line per case; exit 1 on any
// NEW outcome other than the expected one, or any OLD outcome that no longer reproduces the recorded defect.
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createResponseBinder } from '../response-binding.mjs';
import { expectedHash } from '../served-provenance.mjs';

const APP = 'http://127.0.0.1:4173';
const GOOD = Buffer.from('good-asset');
const BAD = Buffer.from('tampered-asset');
const INDEX = Buffer.from('<html>index</html>');
const h = (b) => createHash('sha256').update(b).digest('hex');
const prov = { files: { 'assets/app.js': h(GOOD), 'assets/b.js': h(GOOD) }, served_index_sha256: h(INDEX) };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BOUND_MS = 300;

// Real Playwright semantics modelled: context events fire for every page; a page's own events fire only for that page.
function world() {
  const context = new EventEmitter();
  const pages = [new EventEmitter(), new EventEmitter()];
  const emit = (pi, ev, obj) => { pages[pi].emit(ev, obj); context.emit(ev, obj); };
  const req = (pi, p) => { const r = { url: () => APP + p, method: () => 'GET' }; emit(pi, 'request', r); return r; };
  const respond = (pi, r, { status = 200, body, delay = 0, never = false } = {}) => {
    const res = { url: () => r.url(), request: () => r, status: () => status,
      body: () => (never ? new Promise(() => {}) : sleep(delay).then(() => body)) };
    emit(pi, 'response', res); return res;
  };
  const fail = (pi, r) => emit(pi, 'requestfailed', r);
  return { context, pages, req, respond, fail, listeners: () => ['request', 'response', 'requestfailed'].reduce((n, e) => n + context.listenerCount(e), 0) };
}

// OLD: 4bdb4c5e support.ts net fixture body (binding part), page-only.
function oldArm(w) {
  const unbound = []; const bindings = [];
  w.pages[0].on('response', (r) => {
    const u = new URL(r.url());
    if (u.origin === APP) bindings.push((async () => {
      const want = expectedHash(prov, u.pathname); let got = '';
      try { got = r.status() === 200 ? h(await r.body()) : `status-${r.status()}`; } catch { got = 'unreadable'; }
      if (!want || got !== want) unbound.push(u.pathname);
    })());
  });
  return {
    async verdict() {
      const done = await Promise.race([Promise.all(bindings).then(() => true), sleep(1000).then(() => false)]);
      if (!done) return { v: 'HANG', unbound: unbound.length };
      return { v: unbound.length ? 'UNBOUND' : 'PASS', unbound: unbound.length };
    },
    after: () => unbound.length,
  };
}
function newArm(w) {
  const b = createResponseBinder(w.context, { appOrigin: APP, prov });
  return {
    async verdict() {
      const f = await b.freeze(BOUND_MS);
      const incomplete = f.unfinished > 0 || f.timedOut || f.late > 0;
      return { v: incomplete ? 'REFUSE_INCOMPLETE' : f.unbound.length ? 'UNBOUND' : f.failed.length ? 'FAILED' : 'PASS', unbound: f.unbound.length, f };
    },
    after: () => null,
    binder: b,
  };
}

// Each scenario: setup() runs during "use" (before teardown); during(w) runs concurrently with teardown (the drain).
const SCENARIOS = {
  'late-during-drain (reviewer fake)': {
    use(w) { const r = w.req(0, '/assets/app.js'); w.respond(0, r, { body: GOOD, delay: 40 }); },
    async during(w) { await sleep(10); const r2 = w.req(0, '/assets/b.js'); w.respond(0, r2, { body: BAD, delay: 60 }); },
    want: { OLD: 'PASS', NEW: 'UNBOUND' }, oldAfter: 1,
  },
  'late BAD body (request open at teardown)': {
    use(w) { this.r = w.req(0, '/assets/b.js'); },
    async during(w) { await sleep(30); w.respond(0, this.r, { body: BAD, delay: 20 }); },
    want: { OLD: 'PASS', NEW: 'UNBOUND' }, oldAfter: 1,
  },
  'unanswered request (timeout)': {
    use(w) { w.req(0, '/assets/app.js'); },
    async during() {},
    want: { OLD: 'PASS', NEW: 'REFUSE_INCOMPLETE' }, oldAfter: 0,
  },
  'body never resolves (timeout)': {
    use(w) { const r = w.req(0, '/assets/app.js'); w.respond(0, r, { never: true }); },
    async during() {},
    want: { OLD: 'HANG', NEW: 'REFUSE_INCOMPLETE' }, oldAfter: 0,
  },
  'request failed without response': {
    use(w) { const r = w.req(0, '/assets/app.js'); w.fail(0, r); },
    async during() {},
    want: { OLD: 'PASS', NEW: 'FAILED' }, oldAfter: 0,
  },
  'secondary page BAD body': {
    use(w) { const r = w.req(0, '/'); w.respond(0, r, { body: INDEX }); const r2 = w.req(1, '/assets/b.js'); w.respond(1, r2, { body: BAD }); },
    async during() {},
    want: { OLD: 'PASS', NEW: 'UNBOUND' }, oldAfter: 0,
  },
  'bound positive': {
    use(w) { for (const [pi, p, b] of [[0, '/', INDEX], [0, '/courses', INDEX], [0, '/assets/app.js', GOOD], [1, '/assets/b.js', GOOD]]) w.respond(pi, w.req(pi, p), { body: b, delay: 5 }); },
    async during() {},
    want: { OLD: 'PASS', NEW: 'PASS' }, oldAfter: 0,
  },
};

let bad = 0;
const line = (s) => console.log(s);
for (const [name, sc] of Object.entries(SCENARIOS)) {
  for (const arm of ['OLD', 'NEW']) {
    const w = world(); const ctx = {};
    const a = arm === 'OLD' ? oldArm(w) : newArm(w);
    sc.use.call(ctx, w);
    const [res] = await Promise.all([a.verdict(), sc.during.call(ctx, w)]);
    await sleep(120); // let anything late land, then read what OLD's list holds now
    let extra = '';
    if (arm === 'OLD') extra = ` unbound_after=${a.after()}`;
    else extra = ` frozen=${Object.isFrozen(res.f) && Object.isFrozen(res.f.entries)} listeners_after=${w.listeners()} unfinished=${res.f.unfinished} timedOut=${res.f.timedOut}`;
    const ok = res.v === sc.want[arm] && (arm === 'NEW' ? Object.isFrozen(res.f) && w.listeners() === 0 : a.after() === sc.oldAfter);
    if (!ok) bad++;
    line(`${ok ? 'ok  ' : 'FAIL'} ${arm} ${name}: ${res.v} unbound_at_verdict=${res.unbound}${extra} (want ${sc.want[arm]})`);
  }
}

// Boundary checks on the NEW recorder itself.
{
  const w = world(); const b = createResponseBinder(w.context, { appOrigin: APP, prov });
  w.respond(0, w.req(0, '/assets/app.js'), { body: GOOD });
  const f1 = await b.freeze(BOUND_MS);
  w.respond(0, w.req(0, '/assets/b.js'), { body: BAD }); // after close: listeners are detached, so it is never recorded
  const f2 = await b.freeze(BOUND_MS);
  const ok = f1 === f2 && f1.entries.length === 1 && f1.unbound.length === 0 && w.listeners() === 0;
  if (!ok) bad++;
  line(`${ok ? 'ok  ' : 'FAIL'} NEW freeze is idempotent, detached, and post-close events cannot change the result`);
}
{
  // Cleanup on use failure: the fixture freezes in finally; model a throwing use().
  const w = world(); const b = createResponseBinder(w.context, { appOrigin: APP, prov });
  let threw = false;
  try { try { throw new Error('use failed'); } finally { await b.freeze(BOUND_MS); } } catch { threw = true; }
  const ok = threw && w.listeners() === 0;
  if (!ok) bad++;
  line(`${ok ? 'ok  ' : 'FAIL'} NEW use() failure still freezes and detaches (error propagates)`);
}
{
  // A reduction that finishes only after the deadline: refused at freeze, and counted late when it lands.
  const w = world(); const b = createResponseBinder(w.context, { appOrigin: APP, prov });
  w.respond(0, w.req(0, '/assets/app.js'), { body: GOOD, delay: BOUND_MS + 100 });
  const f = await b.freeze(BOUND_MS); await sleep(200);
  const ok = f.timedOut && f.unfinished === 1 && f.late === 0 && b.lateCount() === 1 && !b.complete() && f.entries.length === 0;
  if (!ok) bad++;
  line(`${ok ? 'ok  ' : 'FAIL'} NEW slow reduction past the bound: frozen result stays refused, late=${b.lateCount()} recorded separately`);
}
line(bad ? `${bad} FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
