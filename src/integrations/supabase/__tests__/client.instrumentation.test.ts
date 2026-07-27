import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInstrumentedFetch, supabaseIssues } from '../instrumentation';

/**
 * The interceptor is the only thing standing between a silent Supabase failure
 * and a page that renders an empty list. These tests cover the three shapes the
 * audit actually found in production code, plus a guard on the wiring itself.
 */

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

const REST = 'https://project.supabase.co/rest/v1';

beforeEach(() => {
  supabaseIssues.length = 0;
});

describe('instrumented fetch', () => {
  it('records the PostgREST code and the columns asked for when a query fails', async () => {
    const base = vi.fn().mockResolvedValue(
      jsonResponse(
        { code: '42703', message: 'column profiles.full_name does not exist' },
        { status: 400 },
      ),
    );
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f(`${REST}/profiles?select=id,full_name,email&limit=1`);

    expect(supabaseIssues).toHaveLength(1);
    expect(supabaseIssues[0]).toMatchObject({
      kind: 'error',
      target: 'profiles',
      status: 400,
      code: '42703',
      select: 'id,full_name,email',
    });
  });

  it('leaves the response body readable by the caller', async () => {
    // The error is read off a clone; consuming the original would break every
    // caller that checks `error.message`.
    const base = vi.fn().mockResolvedValue(jsonResponse({ code: 'PGRST200' }, { status: 400 }));
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    const res = await f(`${REST}/certificates?select=*`);

    await expect(res.json()).resolves.toMatchObject({ code: 'PGRST200' });
  });

  /**
   * The certificate-revoke bug: PostgREST answers 204 when RLS filtered every
   * row, so `if (error)` passes and the UI reports success for a write that
   * never happened.
   */
  it('flags a write that succeeded but changed nothing', async () => {
    const base = vi.fn().mockResolvedValue(
      new Response(null, { status: 204, headers: { 'content-range': '*/0' } }),
    );
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f(`${REST}/certificates?id=eq.abc`, { method: 'DELETE' });

    expect(supabaseIssues).toHaveLength(1);
    expect(supabaseIssues[0]).toMatchObject({ kind: 'empty-write', method: 'DELETE', target: 'certificates' });
  });

  /**
   * `supabase.rpc()` POSTs to `/rest/v1/rpc/<name>`, but a function call is not
   * a write. PostgREST reports the number of rows a set-returning function
   * *returned*, so a read-only counting RPC with nothing to count answers a
   * content-range total of zero. Treating that as an empty write reported a
   * defect on every load of
   * /admin/unified-form-management and failed the spec — the same mistake as
   * flagging PGRST116, and the kind that gets a rule switched off.
   */
  it('does not treat a zero-row rpc response as an empty write', async () => {
    const base = vi.fn().mockResolvedValue(
      new Response('[]', {
        status: 200,
        headers: { 'content-type': 'application/json', 'content-range': '*/0' },
      }),
    );
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f(`${REST}/rpc/form_submission_counts`, { method: 'POST' });

    expect(supabaseIssues).toHaveLength(0);
  });

  /**
   * And the count header is not sent either: computing it for a set-returning
   * function costs a pass over the result for information we cannot interpret.
   */
  it('does not add Prefer to an rpc call', async () => {
    const base = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f(`${REST}/rpc/course_roster_stats`, { method: 'POST' });

    const init = base.mock.calls[0][1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get('Prefer')).toBeNull();
  });

  /**
   * The exclusion is on the rpc path only — a table whose name merely starts
   * with "rpc" is still a table and still gets the check.
   */
  it('still flags an empty write on a table, not being fooled by the rpc prefix', async () => {
    const base = vi.fn().mockResolvedValue(
      new Response(null, { status: 204, headers: { 'content-range': '*/0' } }),
    );
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f(`${REST}/rpc_audit_log?id=eq.abc`, { method: 'DELETE' });

    expect(supabaseIssues).toHaveLength(1);
    expect(supabaseIssues[0]).toMatchObject({ kind: 'empty-write', target: 'rpc_audit_log' });
  });

  it('stays quiet when a write actually affected rows', async () => {
    const base = vi.fn().mockResolvedValue(
      new Response(null, { status: 204, headers: { 'content-range': '0-0/1' } }),
    );
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f(`${REST}/profiles?id=eq.abc`, { method: 'PATCH' });

    expect(supabaseIssues).toHaveLength(0);
  });

  it('asks for the affected-row count on writes without clobbering an existing Prefer', async () => {
    const base = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f(`${REST}/certificates`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
    });

    const sent = new Headers((base.mock.calls[0][1] as RequestInit).headers);
    expect(sent.get('Prefer')).toContain('return=representation');
    expect(sent.get('Prefer')).toContain('count=exact');
  });

  /**
   * `Prefer` is not a CORS-safelisted request header, so adding it makes the
   * browser preflight the call. Edge Functions and Storage do not list `prefer`
   * in Access-Control-Allow-Headers, so the browser blocks the request outright:
   *
   *   Access to fetch at '…/functions/v1/messages-helper' has been blocked by
   *   CORS policy: Request header field prefer is not allowed…
   *
   * That took out the entire messaging feature. Only PostgREST understands the
   * header, so only PostgREST gets it.
   */
  it.each([
    ['edge function', 'https://project.supabase.co/functions/v1/messages-helper'],
    ['storage', 'https://project.supabase.co/storage/v1/object/course-materials/x.pdf'],
  ])('does not add Prefer to a %s write', async (_label, url) => {
    const base = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f(url, { method: 'POST' });

    const init = base.mock.calls[0][1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get('Prefer')).toBeNull();
  });

  it('still adds Prefer to a PostgREST write', async () => {
    const base = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f(`${REST}/certificates`, { method: 'POST' });

    const init = base.mock.calls[0][1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get('Prefer')).toContain('count=exact');
  });

  it('does not touch reads', async () => {
    const base = vi.fn().mockResolvedValue(jsonResponse([]));
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f(`${REST}/courses?select=id`);

    const init = base.mock.calls[0][1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get('Prefer')).toBeNull();
  });

  /**
   * `/interview-prep/mock-interview-room` with no :sessionId queried
   * `mock_sessions?id=eq.undefined` on every load — Postgres rejects it with
   * 22P02, so it is never a real query, only a missing guard.
   */
  it('flags a filter built from an undefined value', async () => {
    const base = vi.fn().mockResolvedValue(jsonResponse([]));
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f(`${REST}/mock_sessions?select=*&id=eq.undefined`);

    expect(supabaseIssues.some((i) => i.kind === 'bad-filter')).toBe(true);
  });

  it('ignores requests that are not Supabase data calls', async () => {
    const base = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }));
    const f = createInstrumentedFetch(base as unknown as typeof fetch);

    await f('https://cdn.example.com/thing.js');

    expect(supabaseIssues).toHaveLength(0);
  });
});

describe('client wiring', () => {
  /**
   * client.ts is marked auto-generated. If it is regenerated, the `global.fetch`
   * option disappears and every check above silently stops running — the same
   * class of failure this module exists to catch. Assert it behaviourally
   * rather than by grepping for a source line.
   */
  it('routes the shared client through the interceptor', async () => {
    // src/test/setup.ts mocks '@/integrations/supabase/client' for the whole
    // suite, so the real module has to be imported explicitly — otherwise this
    // guard would assert against the mock and pass no matter what client.ts says.
    supabaseIssues.length = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ code: '42703', message: 'probe' }, { status: 400 }),
    ) as unknown as typeof fetch;

    try {
      const actual = await vi.importActual<typeof import('../client')>('../client');
      await actual.supabase.from('courses').select('id').limit(1);

      expect(
        supabaseIssues.length,
        'client.ts lost its `global: { fetch: createInstrumentedFetch() }` wiring — ' +
          'Supabase failures are no longer being recorded anywhere.',
      ).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 20_000);
});
