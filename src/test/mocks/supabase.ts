import { vi } from 'vitest';

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
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
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
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockReturnValue(fresh);
}

// Seed an initial builder so the very first test has a working `from()`
// before any beforeEach has run.
resetSupabaseMock();

// NOTE: The `vi.mock('@/integrations/supabase/client', ...)` call lives in
// src/test/setup.ts. Vitest only auto-hoists vi.mock calls that live in the
// test file itself or in the setup file — a vi.mock buried inside this
// imported module runs AFTER the real client has already been loaded.
