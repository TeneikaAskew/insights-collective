// ABOUTME: Tests for the student dashboard progress analytics widget.
// ABOUTME: Locks the assignment_submissions query to the live schema (user_id / workflow_state).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import { useAuth } from '@/contexts/AuthContext';
import { makeSubmission } from '@/test/utils/course-fixtures';
import StudentProgressAnalytics from '@/components/dashboard/StudentProgressAnalytics';

type QueryResult = { data?: unknown; error?: unknown };

// One chainable builder per table; awaiting the chain resolves to the
// table's stubbed result regardless of which filters were applied.
function makeTableBuilder(result: QueryResult) {
  const builder: any = {};
  const promise = Promise.resolve({ data: null, error: null, ...result });
  for (const m of [
    'select', 'eq', 'neq', 'in', 'is', 'order', 'limit',
    'gt', 'gte', 'lt', 'lte', 'not', 'or', 'filter', 'match',
  ]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => promise);
  builder.maybeSingle = vi.fn(() => promise);
  builder.then = (onFulfilled: any, onRejected: any) => promise.then(onFulfilled, onRejected);
  return builder;
}

function mockTables(tables: Record<string, QueryResult>) {
  const builders: Record<string, any> = {};
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => {
      if (!builders[table]) builders[table] = makeTableBuilder(tables[table] ?? {});
      return builders[table];
    }
  );
  return builders;
}

const authedUser = { id: 'user-1', email: 'student@example.com', name: 'Ada' } as any;

function stubHappyPath() {
  return mockTables({
    enrollments: {
      data: [{ course_id: 'course-1', courses: { id: 'course-1', title: 'Intro to Data Analytics' } }],
    },
    modules: {
      data: [{ id: 'm1', title: 'Week 1', week: 1, course_id: 'course-1', position: 1 }],
    },
    content_items: {
      data: [{ id: 'i1', module_id: 'm1', position: 1, title: 'Lesson 1' }],
    },
    content_item_progressions: { data: [] },
    assignments: {
      data: [
        { id: 'a1', title: 'Assignment 1', course_id: 'course-1', due_date: null },
        { id: 'a2', title: 'Assignment 2', course_id: 'course-1', due_date: null },
        { id: 'a3', title: 'Assignment 3', course_id: 'course-1', due_date: null },
        { id: 'a4', title: 'Assignment 4', course_id: 'course-1', due_date: null },
      ],
    },
    assignment_submissions: {
      data: [
        makeSubmission({ assignment_id: 'a1', user_id: 'user-1', workflow_state: 'graded', grade: 95 }),
        makeSubmission({ assignment_id: 'a2', user_id: 'user-1', workflow_state: 'submitted' }),
        makeSubmission({ assignment_id: 'a4', user_id: 'user-1', workflow_state: 'draft' }),
      ],
    },
  });
}

describe('StudentProgressAnalytics', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({ user: authedUser, isAuthenticated: true }) as any
    );
  });

  // REGRESSION: the live assignment_submissions table has user_id and
  // workflow_state — NOT student_id and status (those only exist in an
  // unapplied migration). Querying the wrong columns 400s in production
  // and the whole analytics panel renders as a load error.
  it('queries assignment_submissions with user_id and workflow_state, not student_id/status', async () => {
    const builders = stubHappyPath();

    render(<StudentProgressAnalytics />);
    await screen.findByTestId('student-progress-analytics');

    const submissions = builders['assignment_submissions'];
    expect(submissions.select).toHaveBeenCalledWith(
      expect.stringContaining('workflow_state')
    );
    expect(submissions.select).not.toHaveBeenCalledWith(
      expect.stringMatching(/(^|[,\s])status([,\s]|$)/)
    );
    expect(submissions.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(submissions.eq).not.toHaveBeenCalledWith('student_id', expect.anything());
  });

  it('buckets submissions by workflow_state: graded, awaiting feedback, and to-submit (drafts count as to-submit)', async () => {
    stubHappyPath();

    render(<StudentProgressAnalytics />);
    await screen.findByTestId('student-progress-analytics');

    expect(screen.queryByText('Failed to load progress analytics')).not.toBeInTheDocument();
    // a1 graded, a2 submitted; a3 has no row and a4 is only a draft — both still to submit.
    expect(screen.getByText('1 graded')).toBeInTheDocument();
    expect(screen.getByText('1 awaiting feedback')).toBeInTheDocument();
    expect(screen.getByText('2 to submit')).toBeInTheDocument();
  });
});
