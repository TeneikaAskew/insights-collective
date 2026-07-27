import { vi } from 'vitest';
import DB_FUNCTIONS from '../fixtures/db-functions.json';

/**
 * Every function that exists in the database's public schema.
 *
 * `rpc: vi.fn()` accepts any string, so a unit test can call a function that
 * does not exist and still pass — which is exactly what happened with
 * `select_random_questions`: 893 tests were green against a function that had
 * never been created, and only a live replay found it.
 *
 * The list is checked in because unit tests must run offline and
 * deterministically. It is kept honest by CI, which fails when the committed
 * file no longer matches the database:
 *
 *   node scripts/audit/refresh-db-functions.mjs --check
 */
const KNOWN_RPCS = new Set<string>(DB_FUNCTIONS as string[]);

async function defaultRpc(name: string) {
  assertKnownRpc(name);
  return { data: null, error: null };
}

/** Length of the shared leading substring — a cheap stand-in for "looks alike". */
function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function assertKnownRpc(name: string): void {
  if (KNOWN_RPCS.has(name)) return;

  // Near-misses are the common case — a truncated name, a plural, a renamed
  // function whose call site was missed — so point at the closest candidates
  // rather than dumping 87 names.
  //
  // Rank by shared prefix rather than by splitting on '_': the first token of
  // `get_quiz_questions` is "get", which matches every getter in the schema and
  // buries the one name the caller actually meant.
  const near = [...KNOWN_RPCS]
    .map((n) => ({ n, score: commonPrefix(n, name) }))
    .filter(({ n, score }) => score >= 6 || n.includes(name) || name.includes(n))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ n }) => n);

  throw new Error(
    `supabase.rpc('${name}') — no such function in the database.\n` +
      (near.length ? `Did you mean: ${near.join(', ')}?\n` : '') +
      `If it was just added, run: node scripts/audit/refresh-db-functions.mjs`,
  );
}

// Builds a fresh supabase query builder — a new set of chainable vi.fn()s.
// Every builder method returns `this` by default so tests can chain
// .from().select().eq().order().limit.mockResolvedValue({...}) and have the
// ride-along chain in the service under test see the same object.
function buildQueryBuilder() {
  const builder: any = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    like: vi.fn(),
    ilike: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    contains: vi.fn(),
    containedBy: vi.fn(),
    range: vi.fn(),
    overlaps: vi.fn(),
    match: vi.fn(),
    not: vi.fn(),
    or: vi.fn(),
    filter: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn(),
  };

  // Wire every chainable method to return the same builder instance.
  for (const key of [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'is',
    'in',
    'contains',
    'containedBy',
    'range',
    'overlaps',
    'match',
    'not',
    'or',
    'filter',
    'order',
    'limit',
  ] as const) {
    (builder[key] as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  }

  return builder;
}

// The exported mock client. `from` is a vi.fn so tests can still call
// `.from()` multiple times. The underlying builder is swapped out between
// tests via `resetSupabaseMock()` (invoked from setup.ts beforeEach) so
// mockResolvedValue overrides from one test cannot leak into the next.
export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  from: vi.fn(),
  // Validates the name, then behaves exactly as before. Tests that stub a
  // return value with .mockResolvedValue() replace this implementation entirely
  // and skip the check — which is correct: an explicit stub is the author
  // saying what the call returns, and the CI query gate replays the real name
  // against the database anyway. resetSupabaseMock() restores this between
  // tests so such a stub cannot leak.
  rpc: vi.fn(defaultRpc),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn(),
      download: vi.fn(),
      remove: vi.fn(),
      list: vi.fn(),
      getPublicUrl: vi
        .fn()
        .mockReturnValue({ data: { publicUrl: 'https://example.com/file.jpg' } }),
    }),
  },
  functions: {
    invoke: vi.fn(),
  },
  // Realtime stubs: hooks that subscribe to postgres_changes need a chainable
  // channel object. `on` returns the channel so `.on(...).on(...).subscribe()`
  // chains work; subscribe accepts the status callback without invoking it.
  channel: vi.fn(() => {
    const channel: any = {
      on: vi.fn(() => channel),
      subscribe: vi.fn(() => channel),
      unsubscribe: vi.fn(),
      topic: 'mock-topic',
    };
    return channel;
  }),
  removeChannel: vi.fn().mockResolvedValue('ok'),
};

// Shape of a PostgrestError, for injecting failures into query mocks:
//   mockSupabaseClient.from().select().eq().order.mockResolvedValue(supabaseError('boom'))
// Services under audit must THROW on these — a test asserting
// `rejects.toThrow()` with an injected error proves the failure is not
// silently swallowed into an empty/default result.
export function supabaseError(message: string, code = 'PGRST000') {
  return {
    data: null,
    error: { message, code, details: '', hint: '' },
  };
}

// Returns the builder currently wired to `from()`, so tests can stub a
// terminal method (`single`, `order`, `then`, …) without re-calling `from()`
// and accidentally asserting against a stale builder reference.
export function getQueryBuilder() {
  return (mockSupabaseClient.from as unknown as (...args: any[]) => any)();
}

// Rebuild the query builder so mock state does not leak between tests.
// Called from src/test/setup.ts in a beforeEach.
export function resetSupabaseMock() {
  const fresh = buildQueryBuilder();
  // Clear the call history as well as the builder. Swapping the return value
  // left `from.mock.calls` accumulating across every test in a file, so
  // `expect(from).not.toHaveBeenCalledWith('some_table')` reported a call an
  // earlier test had made — an assertion that silently cannot pass.
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockClear();
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockReturnValue(fresh);
  // rpc too: a test that stubs it with mockResolvedValue replaces the name
  // validation, and without this the next test would silently inherit both the
  // stubbed value and the missing check.
  (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>).mockReset();
  (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>).mockImplementation(defaultRpc);
}

// Seed an initial builder so the very first test has a working `from()`
// before any beforeEach has run.
resetSupabaseMock();

// NOTE: The `vi.mock('@/integrations/supabase/client', ...)` call lives in
// src/test/setup.ts. Vitest only auto-hoists vi.mock calls that live in the
// test file itself or in the setup file — a vi.mock buried inside this
// imported module runs AFTER the real client has already been loaded.
