// ABOUTME: Regression tests for CertificationSystem issue mode — the
// ABOUTME: check_course_completion RPC must be called with the DB function's real
// ABOUTME: parameter names (p_course_id, p_student_id), not the old broken p_user_id.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CertificationSystem from '@/components/certification/CertificationSystem';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { makeCourse, makeCertificate } from '@/test/utils/course-fixtures';

const COURSE_ID = 'course-1';
const USER_ID = 'user-1';

// Issue mode gates the generate button on courseProgress.overall_completion.
vi.mock('@/hooks/useProgressTracking', () => ({
  useProgressTracking: () => ({
    courseProgress: { overall_completion: 100, total_time_spent: 3600 },
    moduleProgress: null,
    contentProgress: [],
    loading: false,
    error: null,
  }),
}));

type StubResponse = { row?: unknown; rows?: unknown[]; error?: unknown };

function tableStub({ row = null, rows = [], error = null }: StubResponse) {
  const b: any = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte']) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(async () => ({ data: error ? null : row, error }));
  b.single = vi.fn(async () => ({ data: error ? null : row, error }));
  b.then = (resolve: (v: unknown) => void) =>
    resolve({ data: error ? null : rows, error, count: rows.length });
  return b;
}

let tables: Record<string, any>;

describe('CertificationSystem (issue mode) — check_course_completion RPC', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: USER_ID, email: 'student@example.com', user_metadata: {} },
      loading: false,
    } as any);
    tables = {
      courses: tableStub({ row: makeCourse({ id: COURSE_ID }) }),
      certificates: tableStub({ rows: [] }),
    };
    (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
      (table: string) => tables[table] ?? tableStub({})
    );
    (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: true,
      error: null,
    });
  });

  it('calls the RPC with p_course_id/p_student_id — the DB function signature', async () => {
    render(<CertificationSystem courseId={COURSE_ID} mode="issue" />);

    const button = await screen.findByRole('button', { name: /view my certificate/i });
    await userEvent.click(button);

    await waitFor(
      () =>
        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('check_course_completion', {
          p_course_id: COURSE_ID,
          p_student_id: USER_ID,
        }),
      { timeout: 3000 }
    );
    // The broken parameter name must never be sent again.
    const rpcCalls = (mockSupabaseClient.rpc as ReturnType<typeof vi.fn>).mock.calls;
    for (const [, args] of rpcCalls) {
      expect(args).not.toHaveProperty('p_user_id');
    }
  });

  it('shows the issued certificate after a successful refresh', async () => {
    render(<CertificationSystem courseId={COURSE_ID} mode="issue" />);

    const button = await screen.findByRole('button', { name: /view my certificate/i });

    // The re-fetch after the RPC finds the freshly issued certificate.
    tables.certificates = tableStub({
      rows: [makeCertificate({ user_id: USER_ID, course_id: COURSE_ID })],
    });
    await userEvent.click(button);

    expect(
      await screen.findByText('Certificate already issued!', undefined, { timeout: 3000 })
    ).toBeInTheDocument();
  });
});
