// ABOUTME: Context-wide binding of every app-origin response to the hermetic provenance, with an explicit capture boundary.
// ABOUTME: Follows the shared c199ba7 case-recorder lessons: sequence at request, in-flight set, bounded drain, close, detach, freeze.
//
// Lifecycle (one recorder per test, attached to the BrowserContext before any navigation, so popups and second pages count):
//   request        an app-origin request is given a sequence number and joins the in-flight set
//   response       it leaves in-flight; a body reduction job (sha256 of the body vs expectedHash) joins the pending set
//   requestfailed  it leaves in-flight and is recorded as FAILED (no bytes were delivered)
//   freeze(ms)     drains until BOTH sets are empty, re-checking after every settle because a job may start while another
//                  is awaited; stops at the deadline. Then intake CLOSES and listeners are DETACHED. The result is a deep,
//                  frozen copy, ordered by request sequence. Anything still pending/in flight at the deadline makes the
//                  result INCOMPLETE, which callers must treat as a refusal, never as PASS. After detach no new event is
//                  received; only a reduction that was already pending can still finish, and it is dropped and counted as
//                  late (lateCount()), never written into the frozen result. Evidence covers traffic THROUGH the boundary.
// Reductions keep only the URL path, a fixed verdict and the status; never a body, header or query.
import { createHash } from 'node:crypto';
import { expectedHash } from './served-provenance.mjs';

export const B = { BOUND: 'BOUND', UNBOUND: 'UNBOUND', FAILED: 'FAILED' };
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

export function createResponseBinder(target, { appOrigin, prov }) {
  const seqOf = new WeakMap();
  const inflight = new Set();
  const pending = new Set();
  const slots = new Map();
  let nextSeq = 0; let closed = false; let attached = true; let late = 0; let snapshot = null;
  const isApp = (u) => { try { return new URL(u).origin === appOrigin; } catch { return false; } };
  const pathOf = (u) => new URL(u).pathname;

  const onRequest = (req) => {
    if (closed) { if (isApp(req.url())) late++; return; }
    if (!isApp(req.url())) return;
    seqOf.set(req, nextSeq++); inflight.add(req);
  };
  const onFailed = (req) => {
    if (closed) { if (isApp(req.url())) late++; return; }
    if (!inflight.has(req)) return;
    inflight.delete(req);
    slots.set(seqOf.get(req), { path: pathOf(req.url()), verdict: B.FAILED, status: 'none' });
  };
  const onResponse = (r) => {
    if (closed) { if (isApp(r.url())) late++; return; }
    if (!isApp(r.url())) return;
    const req = r.request();
    const seq = seqOf.has(req) ? seqOf.get(req) : nextSeq++; // a response whose request predates the boundary still counts
    inflight.delete(req);
    const p = pathOf(r.url());
    const job = (async () => {
      const want = expectedHash(prov, p);
      let status = 'none'; let got = '';
      try { status = r.status(); got = status === 200 ? sha256(await r.body()) : `status-${status}`; } catch { got = 'unreadable'; }
      if (closed) { late++; return; } // finished after the boundary: dropped, and it makes the result incomplete
      slots.set(seq, { path: p, verdict: want && got === want ? B.BOUND : B.UNBOUND, status });
    })();
    pending.add(job); job.finally(() => pending.delete(job));
  };
  const detach = () => {
    if (!attached) return; attached = false;
    target.off('request', onRequest); target.off('response', onResponse); target.off('requestfailed', onFailed);
  };
  target.on('request', onRequest); target.on('response', onResponse); target.on('requestfailed', onFailed);

  return {
    async freeze(timeoutMs = 5000) {
      if (snapshot) return snapshot;
      const deadline = Date.now() + timeoutMs;
      let timedOut = false;
      // Drain: a reduction may start while another is awaited, so re-check both sets after every settle.
      while (pending.size || inflight.size) {
        const left = deadline - Date.now();
        if (left <= 0) { timedOut = true; break; }
        let timer;
        const tick = new Promise((res) => { timer = setTimeout(res, Math.min(left, 50)); });
        // With no reduction pending (only an unanswered request), wait on the timer alone: racing an empty allSettled would
        // resolve at once and spin on microtasks, starving the very response the drain is waiting for.
        await (pending.size ? Promise.race([Promise.allSettled([...pending]), tick]) : tick);
        clearTimeout(timer);
      }
      const unfinished = pending.size + inflight.size;
      closed = true; detach();
      const entries = [...slots.keys()].sort((a, b) => a - b).map((k) => Object.freeze({ ...slots.get(k) }));
      const result = {
        entries: Object.freeze(entries),
        unbound: Object.freeze(entries.filter((e) => e.verdict === B.UNBOUND).map((e) => e.path)),
        failed: Object.freeze(entries.filter((e) => e.verdict === B.FAILED).map((e) => e.path)),
        unfinished, timedOut,
        late,
      };
      snapshot = Object.freeze(result);
      return snapshot;
    },
    /** Complete only when nothing was unfinished at the boundary and nothing arrived after it (live count). */
    complete() { return !!snapshot && snapshot.unfinished === 0 && !snapshot.timedOut && late === 0; },
    lateCount() { return late; },
    detach,
  };
}
