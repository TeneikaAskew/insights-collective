// ABOUTME: One choke point for every Supabase request, so a failure cannot be silent.
// ABOUTME: Wraps fetch — no call site changes, and no call site can opt out.
//
// Why this exists
// ---------------
// Every defect found in the audit was the same shape: something reported success
// while doing nothing. A grade PATCH that RLS filtered to zero rows still
// answered 204. A certificate revoke deleted nothing and the UI said "revoked".
// Three pages returned 42703 on every load and the e2e suite stayed green.
//
// More logging would not have helped — the errors were already logged.
// `[CanvasQuizResults] Error loading quiz results` printed on every run of a
// passing test. What was missing is a single place that sees every request,
// emits structured data rather than prose, and can be read by a test.
//
// Scope: 641 `.from()` call sites, 44 `.rpc()` sites. None of them change.

import { createLogger } from '@/utils/logger';

const logger = createLogger('Supabase');

export interface SupabaseIssue {
  kind: 'error' | 'empty-write' | 'bad-filter';
  method: string;
  /** Table or rpc/<name>, parsed from the PostgREST path. */
  target: string;
  status: number;
  /** PostgREST error code (42703, PGRST200, …) when the body carries one. */
  code?: string;
  message?: string;
  /** Column list the query asked for, when present — the usual culprit. */
  select?: string;
  /** Route the user was on, so a report says where to look. */
  route: string;
  at: string;
}

/**
 * Ring buffer of everything this module noticed. e2e reads it directly instead
 * of scraping console text, and the dev overlay renders it.
 */
const MAX_ISSUES = 100;
export const supabaseIssues: SupabaseIssue[] = [];
type Listener = (issue: SupabaseIssue) => void;
const listeners = new Set<Listener>();

export function onSupabaseIssue(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function record(issue: SupabaseIssue): void {
  supabaseIssues.push(issue);
  if (supabaseIssues.length > MAX_ISSUES) supabaseIssues.shift();
  listeners.forEach((fn) => {
    try {
      fn(issue);
    } catch {
      // A misbehaving listener must not break the request it is reporting on.
    }
  });
}

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** `/rest/v1/certificates?select=…` → `certificates`; `/rest/v1/rpc/foo` → `rpc/foo`. */
function parseTarget(url: URL): string {
  const path = url.pathname;
  for (const prefix of ['/rest/v1/', '/functions/v1/', '/storage/v1/']) {
    if (path.startsWith(prefix)) return path.slice(prefix.length) || path;
  }
  return path;
}

function currentRoute(): string {
  try {
    return typeof window !== 'undefined' ? window.location.pathname : 'n/a';
  } catch {
    return 'n/a';
  }
}

/**
 * Add `count=exact` to writes so PostgREST reports how many rows were affected.
 *
 * Verified against the live project: a DELETE that matches a row answers a
 * content-range total of 1, one that matches nothing answers 0, and a PATCH that
 * RLS filters out answers 0 while a permitted one answers `0-0/1`. That is the
 * whole silent-write problem made observable.
 *
 * supabase-js joins Prefer values rather than replacing them
 * (PostgrestQueryBuilder appends to `this.headers['Prefer']`), so adding ours
 * cannot clobber `return=representation` or `resolution=merge-duplicates`.
 *
 * Cost, measured against the live project on the hottest write path — the
 * `content_item_progressions` upsert a student fires on every "mark as done"
 * (150 interleaved samples per arm, member role):
 *
 *              p25    p50    p75    p90
 *   without   65.9   67.8   72.3   78.4
 *   with      66.2   68.2   73.0   85.2
 *   delta     +0.3   +0.3   +0.7   +6.7    trimmed mean +0.8ms
 *
 * +0.5% of a 68ms round trip. The count is computed in the same statement that
 * does the write, so there is no extra query — only the header. Both arms show
 * the same occasional 300ms outlier, which is shared-tenancy network variance
 * rather than anything this adds.
 */
function withCountPreference(
  init: RequestInit | undefined,
  method: string,
  isPostgrest: boolean,
): RequestInit | undefined {
  if (!WRITE_METHODS.has(method)) return init;
  // PostgREST only. `Prefer` means nothing to Edge Functions or Storage, and
  // adding it there is actively harmful: it is not a CORS-safelisted header, so
  // the browser preflights it, and a function whose Access-Control-Allow-Headers
  // does not list `prefer` has the request blocked outright. That broke every
  // messages-helper call — the whole messaging feature — until the e2e suite
  // caught it.
  if (!isPostgrest) return init;
  const headers = new Headers(init?.headers);
  const existing = headers.get('Prefer');
  if (existing?.includes('count=')) return init;      // caller asked for a specific count mode
  headers.set('Prefer', existing ? `${existing},count=exact` : 'count=exact');
  return { ...init, headers };
}

/** content-range encodes the affected total after the slash: `0-0/1`, or `0` when none. */
function affectedRows(res: Response): number | null {
  const range = res.headers.get('content-range');
  if (!range) return null;
  const total = range.split('/')[1];
  if (total === undefined || total === '*') return null;
  const n = Number(total);
  return Number.isFinite(n) ? n : null;
}

/**
 * A route param that arrived undefined becomes the literal string in the URL —
 * `mock_sessions?id=eq.undefined` produced 22P02 on every load of the mock
 * interview room. Postgres rejects it, so it is never a real query.
 */
function badFilterValue(url: URL): string | null {
  for (const [key, value] of url.searchParams) {
    if (/^(eq|neq|gt|gte|lt|lte|like|ilike|in|is)\.(undefined|null)$/.test(value) && value.endsWith('undefined')) {
      return `${key}=${value}`;
    }
  }
  return null;
}

export function createInstrumentedFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async function instrumentedFetch(input, init) {
    const method = (init?.method ?? 'GET').toUpperCase();
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    let url: URL | null = null;
    try {
      url = new URL(rawUrl);
    } catch {
      // Not something we can inspect — pass it straight through untouched.
      return baseFetch(input, init);
    }

    const isData = /\/(rest|functions|storage)\/v1\//.test(url.pathname);
    if (!isData) return baseFetch(input, init);
    // Only PostgREST understands `Prefer: count=exact` — see withCountPreference.
    const isPostgrest = url.pathname.includes('/rest/v1/');

    const target = parseTarget(url);
    const route = currentRoute();
    const select = url.searchParams.get('select') ?? undefined;

    const badFilter = badFilterValue(url);
    if (badFilter) {
      const issue: SupabaseIssue = {
        kind: 'bad-filter', method, target, status: 0, route, at: new Date().toISOString(),
        message: `filter carries an undefined value (${badFilter}) — a route param or state was not ready`,
      };
      record(issue);
      logger.error('query built from an undefined value', issue);
    }

    const res = await baseFetch(input, withCountPreference(init, method, isPostgrest));

    if (!res.ok) {
      // Read the error off a clone so the caller still gets an unconsumed body.
      let code: string | undefined;
      let message: string | undefined;
      try {
        const body = await res.clone().json();
        code = body?.code;
        message = body?.message;
      } catch {
        // Non-JSON error bodies (edge functions, storage) carry no code.
      }
      const issue: SupabaseIssue = {
        kind: 'error', method, target, status: res.status, code, message, select, route,
        at: new Date().toISOString(),
      };
      record(issue);
      logger.error(`${method} ${target} failed`, issue);
      return res;
    }

    if (WRITE_METHODS.has(method)) {
      const affected = affectedRows(res);
      if (affected === 0) {
        // The bug this whole layer exists for: PostgREST answers 2xx when RLS
        // filtered every row, so the caller's `if (error)` check passes and the
        // UI reports success for a write that never happened.
        const issue: SupabaseIssue = {
          kind: 'empty-write', method, target, status: res.status, route,
          at: new Date().toISOString(),
          message:
            `${method} affected 0 rows. The request succeeded but nothing changed — ` +
            `usually RLS filtering every row, or a filter that matches nothing.`,
        };
        record(issue);
        logger.error(`${method} ${target} changed nothing`, issue);
      }
    }

    return res;
  } as typeof fetch;
}

/** e2e reads this instead of parsing console output. */
declare global {
  interface Window {
    __supabaseIssues?: SupabaseIssue[];
  }
}
if (typeof window !== 'undefined') {
  window.__supabaseIssues = supabaseIssues;
}
