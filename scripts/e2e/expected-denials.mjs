// ABOUTME: Bounded, per-test declaration of EXACT expected PostgREST denials for the shared console-errors fixture.
// ABOUTME: Only 403/42501 may be declared; each declaration must match exactly `count` issues, else the test fails.
//
// The console-errors fixture treats every 42501 a page receives as structural (issue-triage.ts), which is right for a page's
// own queries. A spec that DELIBERATELY provokes an authorization refusal from a guarded RPC (e.g. T62: start_quiz_attempt
// after access was revoked on synthetic rows) can declare that one refusal here, exactly: method, target, status, code,
// message, route, the earliest time (phase) and the exact count. Anything not matched stays fatal, and a declaration that
// does not match exactly `count` issues is itself a failure. There is no pattern, wildcard or blanket form.

const TARGET = /^(rpc\/[a-z_][a-z0-9_]*|[a-z_][a-z0-9_]*)$/;
const METHOD = /^(GET|HEAD|POST|PATCH|PUT|DELETE)$/;

/** Returns null when the declaration is acceptable, else a fixed reason token. */
export function declarationProblem(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return 'not_object';
  const keys = Object.keys(d).sort().join();
  if (keys !== 'after,code,count,message,method,route,status,target') return 'keys';
  if (typeof d.method !== 'string' || !METHOD.test(d.method)) return 'method';
  if (typeof d.target !== 'string' || !TARGET.test(d.target)) return 'target';
  if (d.status !== 403) return 'status';                 // the only declarable status
  if (d.code !== '42501') return 'code';                  // the only declarable code
  if (typeof d.message !== 'string' || d.message.length === 0 || d.message.length > 200) return 'message';
  if (typeof d.route !== 'string' || !/^\/[^\s?#]*$/.test(d.route)) return 'route';
  if (!Number.isSafeInteger(d.count) || d.count < 1 || d.count > 10) return 'count';
  if (!Number.isSafeInteger(d.after) || d.after <= 0) return 'after';
  return null;
}

const matches = (d, i) => i && i.kind === 'error' && i.method === d.method && i.target === d.target && i.status === d.status
  && i.code === d.code && i.message === d.message && i.route === d.route && Date.parse(i.at) >= d.after;

/**
 * Splits structural issues into the ones consumed by declarations and the ones that stay fatal.
 * problems lists a fixed line per bad or unmet declaration; any problem fails the test.
 * @returns {{ unexpected: object[], consumed: object[], problems: string[] }}
 */
export function partitionExpectedDenials(structural, declared) {
  const problems = [];
  const consumed = new Set();
  (declared ?? []).forEach((d, n) => {
    const bad = declarationProblem(d);
    if (bad) { problems.push(`expected-denial #${n + 1} rejected: ${bad}`); return; }
    const hit = structural.filter((i) => !consumed.has(i) && matches(d, i));
    if (hit.length !== d.count) {
      problems.push(`expected-denial #${n + 1} ${d.method} ${d.target} ${d.status}/${d.code} on ${d.route}: expected exactly ${d.count}, observed ${hit.length}`);
      return;                                               // nothing consumed: the observed issues stay fatal too
    }
    for (const i of hit) consumed.add(i);
  });
  return { unexpected: structural.filter((i) => !consumed.has(i)), consumed: structural.filter((i) => consumed.has(i)), problems };
}
