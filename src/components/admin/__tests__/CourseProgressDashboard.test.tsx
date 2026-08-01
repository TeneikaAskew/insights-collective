// ABOUTME: Regression tests for the admin progress dashboard's failure handling —
// ABOUTME: a broken query must never render as zeros that look like real data.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { CourseProgressDashboard } from '../CourseProgressDashboard';

const courses = [
  { id: 'course-1', title: 'Intro to Data', category: 'Data', published: true },
] as any;

type Result = { data?: unknown; error?: unknown };

function mockTables(results: Record<string, Result>) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    const result = results[table] ?? { data: [], error: null };
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    for (const m of ['eq', 'in', 'order', 'limit', 'not', 'is']) builder[m] = vi.fn(() => builder);
    builder.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
    return builder;
  });
}

describe('CourseProgressDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an error state instead of zeros when the enrollment query fails', async () => {
    // REGRESSION: every read was `res.data ?? []`, so a failed query rendered
    // 0 enrolled / 0 completed / 0% / 0 certificates for every course, styled
    // like real data and stamped with a fresh "refreshed at" time.
    mockTables({
      enrollments: { data: null, error: { message: 'permission denied' } },
      content_items: { data: [], error: null },
      certificates: { data: [], error: null },
    });

    render(<CourseProgressDashboard courses={courses} />);

    expect(await screen.findByText(/Course progress is unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    // The fabricated numbers must not be on screen at all.
    expect(screen.queryByText('Total enrollments')).not.toBeInTheDocument();
  });

  it('names which dataset failed', async () => {
    mockTables({
      enrollments: { data: [], error: null },
      content_items: { data: [], error: null },
      certificates: { data: null, error: { message: 'boom' } },
    });

    render(<CourseProgressDashboard courses={courses} />);

    expect(await screen.findByText(/certificates/i)).toBeInTheDocument();
  });

  it('renders the table normally when every query succeeds', async () => {
    mockTables({
      enrollments: { data: [], error: null },
      content_items: { data: [], error: null },
      certificates: { data: [], error: null },
    });

    render(<CourseProgressDashboard courses={courses} />);

    expect(await screen.findByText('Total enrollments')).toBeInTheDocument();
    expect(screen.queryByText(/Course progress is unavailable/i)).not.toBeInTheDocument();
  });
});
