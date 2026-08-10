// ABOUTME: Proves the unit-test Supabase mock rejects .rpc() names that do not exist.
// ABOUTME: Without this the guard could silently stop working and nothing would notice.

import { describe, it, expect, beforeEach } from 'vitest';
import { mockSupabaseClient, resetSupabaseMock } from '../supabase';

/**
 * `rpc: vi.fn()` accepted any string, which is how 893 tests stayed green
 * against `select_random_questions` — a function that had never been created.
 * The guard checks names against src/test/fixtures/db-functions.json, refreshed
 * from the live catalog by scripts/audit/refresh-db-functions.mjs and
 * verified in CI.
 */
describe('supabase mock rpc validation', () => {
  beforeEach(() => resetSupabaseMock());

  it('allows a function that exists', async () => {
    await expect(mockSupabaseClient.rpc('has_admin_access')).resolves.toEqual({
      data: null,
      error: null,
    });
  });

  it('rejects a function that does not exist', async () => {
    await expect(mockSupabaseClient.rpc('select_random_questions')).rejects.toThrow(
      /no such function in the database/,
    );
  });

  it('points at the closest real name when there is one', async () => {
    // `get_quiz_questions_for_taking` is real; this near-miss should surface it.
    await expect(mockSupabaseClient.rpc('get_quiz_questions')).rejects.toThrow(
      /get_quiz_questions_for_taking/,
    );
  });

  it('still lets a test stub the return value', async () => {
    // Replacing the implementation skips the check by design — an explicit stub
    // is the author stating what the call returns, and the CI query gate
    // replays the real name against the database regardless.
    (mockSupabaseClient.rpc as ReturnType<typeof import('vitest').vi.fn>).mockResolvedValue({
      data: [{ id: 1 }],
      error: null,
    });
    await expect(mockSupabaseClient.rpc('has_admin_access')).resolves.toEqual({
      data: [{ id: 1 }],
      error: null,
    });
  });

  it('restores the check after a stubbing test', async () => {
    // The previous test replaced the implementation. If resetSupabaseMock did
    // not put it back, this would resolve instead of throwing and every later
    // test in the suite would run unguarded.
    await expect(mockSupabaseClient.rpc('select_random_questions')).rejects.toThrow(
      /no such function/,
    );
  });
});
