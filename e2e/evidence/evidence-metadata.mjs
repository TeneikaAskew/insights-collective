// ABOUTME: Validation for everything the frontend evidence spec attaches. Labels must have a fixed shape or the spec
// ABOUTME: refuses to run; API metadata is reduced to validated primitives; foreign-origin response bodies are never read.
// Pure functions, no I/O: unit-tested in src/test/e2e/evidenceMetadata.test.ts.

export const VIEWPORT_NAMES = Object.freeze(['desktop-1440x900', 'tablet-768x1024', 'mobile-390x844']);
export const STEPS = Object.freeze(['01-catalog', '02-course-detail', '03-admin-as-member']);
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const API_PATH = /^\/(rest|auth|functions|storage)\/v1(\/[A-Za-z0-9_-]{1,64}){0,4}\/?$/;
const APP_PATH = /^\/[A-Za-z0-9_\/-]{0,200}$/;
export const MAX_IDS = 50;

/** Labels come from the workflow. Anything off-shape is refused, not trimmed. */
export function validateLabels(env) {
  const problems = [];
  const commit = env.E2E_EVIDENCE_COMMIT ?? '';
  const environment = env.E2E_EVIDENCE_ENVIRONMENT ?? '';
  if (!/^[0-9a-f]{40}$/.test(commit)) problems.push('E2E_EVIDENCE_COMMIT must be a 40-character lowercase hex SHA');
  if (!/^[\x20-\x7E]{1,240}$/.test(environment)) problems.push('E2E_EVIDENCE_ENVIRONMENT must be 1-240 printable ASCII characters');
  return { ok: problems.length === 0, problems, labels: { commit, environment } };
}

/** Attachment names are built only from validated parts, so no label or response text reaches a name. */
export function attachmentName({ commit, viewport, step, retry, kind }) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('attachmentName: commit is not a validated SHA');
  if (!VIEWPORT_NAMES.includes(viewport)) throw new Error(`attachmentName: unknown viewport`);
  if (step !== 'manifest' && !STEPS.includes(step)) throw new Error(`attachmentName: unknown step`);
  if (!Number.isInteger(retry) || retry < 0 || retry > 9) throw new Error('attachmentName: retry out of range');
  if (!['png', 'json'].includes(kind)) throw new Error('attachmentName: unknown kind');
  return `${commit.slice(0, 12)}__${viewport}__${step}__retry${retry}.${kind}`;
}

export function apiPath(pathname) { return typeof pathname === 'string' && API_PATH.test(pathname) ? pathname : '<unrecognized path>'; }
export function appPath(pathname) { return typeof pathname === 'string' && APP_PATH.test(pathname) ? pathname : '<unrecognized path>'; }
export function method(m) { return typeof m === 'string' && METHODS.has(m) ? m : 'OTHER'; }
export function status(s) { return Number.isInteger(s) && s >= 100 && s <= 599 ? s : 0; }

/** Row count and course ids from a parsed JSON body. Only strings in UUID form are kept; everything else is counted. */
export function courseRows(body) {
  if (!Array.isArray(body)) return { rows: null, ids: [], rejectedIds: 0 };
  const ids = []; let rejected = 0;
  for (const row of body) {
    const id = row && typeof row === 'object' ? row.id : undefined;
    if (typeof id === 'string' && UUID.test(id)) { if (ids.length < MAX_IDS) ids.push(id); } else rejected += 1;
  }
  return { rows: body.length, ids, rejectedIds: rejected };
}

/**
 * One API response reduced to primitives. `isConfiguredApi` says whether the response came from the configured
 * loopback API origin; for anything else the body is never read and the host is not recorded, only that it was
 * foreign. `readJson` is only called for the configured API.
 */
export async function apiRecord({ isConfiguredApi, pathname, requestMethod, responseStatus, contentType, readJson }) {
  const base = { origin: isConfiguredApi ? 'configured-loopback-api' : 'FOREIGN', method: method(requestMethod), path: apiPath(pathname), status: status(responseStatus) };
  if (!isConfiguredApi) return { ...base, rows: null, courseIds: [], rejectedIds: 0 };
  let parsed = { rows: null, ids: [], rejectedIds: 0 };
  if (typeof contentType === 'string' && contentType.includes('json')) {
    try {
      const body = await readJson();
      parsed = base.path === '/rest/v1/courses' ? courseRows(body) : { rows: Array.isArray(body) ? body.length : null, ids: [], rejectedIds: 0 };
    } catch { /* body unavailable: recorded as rows null */ }
  }
  return { ...base, rows: parsed.rows, courseIds: parsed.ids, rejectedIds: parsed.rejectedIds };
}

export const AUTHENTIC = 'authentic local Supabase (loopback, no stubs)';

/** Backend mode from one API snapshot: authentic only if every response came from the configured loopback API. */
export function backendFrom(api, apiOk) {
  const foreign = api.filter((c) => c.origin !== 'configured-loopback-api').length;
  return { mode: apiOk && foreign === 0 && api.length > 0 ? AUTHENTIC : 'NOT AUTHENTIC', foreignResponses: foreign, responses: api.length, stubs: 0 };
}

/**
 * Collects API records produced asynchronously by response handlers. settle() waits for every pending record,
 * including records whose tasks were added while it was waiting. snapshot() returns an immutable copy of what has
 * been observed so far and starts a new window, so a response that arrives later belongs to the next window
 * instead of being lost or silently added to evidence already taken.
 */
export function createApiObserver() {
  const pending = new Set();
  let window = [];
  return {
    record(promise) {
      const task = Promise.resolve(promise).then((rec) => { window.push(Object.freeze({ ...rec, courseIds: Object.freeze([...(rec.courseIds || [])]) })); });
      pending.add(task);
      task.finally(() => pending.delete(task)).catch(() => {});
      return task;
    },
    async settle() { while (pending.size > 0) await Promise.allSettled([...pending]); },
    snapshot() { const snap = Object.freeze(window); window = []; return snap; },
    pendingCount() { return pending.size; },
  };
}

/**
 * One evidence window: take the screenshot, THEN settle every pending observation, take ONE snapshot, and derive the
 * backend mode and the step's outcome synchronously from that same snapshot. Nothing observed after the snapshot can
 * change what is attached with this screenshot; it is reported in the next window (or the final tail check).
 */
export async function captureWindow({ observer, screenshot, apiOk, outcomeFrom }) {
  const png = await screenshot();
  await observer.settle();
  const api = observer.snapshot();
  const backend = backendFrom(api, apiOk);
  const outcome = outcomeFrom(api);
  return { png, api, backend, outcome };
}
