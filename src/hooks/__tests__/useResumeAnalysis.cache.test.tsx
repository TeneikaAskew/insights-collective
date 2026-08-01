// ABOUTME: Regression tests for the resume-existence check: a failed check must
// ABOUTME: neither destroy the cached analysis nor hide it.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import { useResumeAnalysis } from '../useResumeAnalysis';

const USER_ID = 'user-1';
const CACHED = { overallScore: 82, summary: 'Cached analysis' };

/** The existence check is the first `resumes` read the hook performs. */
function mockResumeCheck(result: { data: unknown; error: unknown }) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const builder: any = {};
    for (const m of ['select', 'eq', 'order', 'limit']) builder[m] = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    builder.single = vi.fn(() => Promise.resolve(result));
    return builder;
  });
}

describe('useResumeAnalysis — resume existence check', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // The suite-wide localStorage mock (src/test/setup.ts) is bare vi.fn()s with
    // no backing store, so getItem always returns undefined. This test is about
    // what does and does not survive in that store, so it needs a real one.
    const store = new Map<string, string>();
    vi.mocked(localStorage.getItem).mockImplementation((k: string) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k: string, v: string) => { store.set(k, v); });
    vi.mocked(localStorage.removeItem).mockImplementation((k: string) => { store.delete(k); });
    vi.mocked(localStorage.clear).mockImplementation(() => { store.clear(); });

    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({ user: { id: USER_ID } as any, isAuthenticated: true }) as any,
    );
    localStorage.setItem(`resume_analysis_${USER_ID}`, JSON.stringify(CACHED));
  });

  it('keeps AND loads the cached analysis when the check fails', async () => {
    // REGRESSION (two of them). The original code treated a failed check like
    // "no resume" and deleted the cache. The first fix returned early instead,
    // which stopped the deletion but skipped the cache read below — and since
    // no dependency changes, the effect never runs again, so a transient
    // failure hid a usable analysis for the rest of the mount.
    mockResumeCheck({ data: null, error: { message: 'timeout' } });

    const { result } = renderHook(() => useResumeAnalysis());

    await waitFor(() => expect(result.current.analysis).toBeTruthy());
    expect(localStorage.getItem(`resume_analysis_${USER_ID}`)).not.toBeNull();
  });

  it('clears the cache only when the check confirms no resume exists', async () => {
    mockResumeCheck({ data: null, error: null });

    renderHook(() => useResumeAnalysis());

    await waitFor(() =>
      expect(localStorage.getItem(`resume_analysis_${USER_ID}`)).toBeNull(),
    );
  });
});
