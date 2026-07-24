// Tests for the inline assignment submit form: the regression that a failed
// submission/rubric-link load renders an error state instead of the form (a
// blind form would insert a duplicate submission with a wrong attempt
// number), that an absent max_attempts is treated as unlimited (no invented
// 3-attempt policy), and that a rubric-criteria failure surfaces an inline
// notice instead of silently hiding the rubric.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeSubmission } from '@/test/utils/course-fixtures';
import { InlineAssignmentSubmit } from '@/components/course/learn/InlineAssignmentSubmit';

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({
    user: { id: 'user-1', email: 'student@example.com' },
    session: {},
    loading: false,
    error: null,
    isAuthenticated: true,
    isAdmin: false,
  }),
}));

// --- supabase query-builder helper (see CanvasGradingInterface.test.tsx) ----
type TableResult = { data: unknown; error: unknown } | Error | Promise<unknown>;

function makeTableBuilder(...results: TableResult[]) {
  let call = 0;
  const builder: any = {};
  for (const m of [
    'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'in', 'is',
    'order', 'limit', 'range', 'single', 'maybeSingle', 'filter', 'or', 'not',
    'match', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
  ]) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (onFulfilled: any, onRejected: any) => {
    const r =
      results.length === 0
        ? { data: null, error: null }
        : results[Math.min(call++, results.length - 1)];
    const p = r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    return p.then(onFulfilled, onRejected);
  };
  return builder;
}

function useTables(tables: Record<string, any>) {
  (mockSupabaseClient.from as any).mockImplementation(
    (table: string) => tables[table] ?? makeTableBuilder(),
  );
  return tables;
}
// ---------------------------------------------------------------------------

const item = { id: 'item-1', title: 'Homework 1', type: 'assignment' } as any;

// No max_attempts configured on purpose — the component must not invent one.
const assignment = {
  id: 'assignment-1',
  submission_types: ['online_text_entry'],
  points_possible: 10,
} as any;

describe('InlineAssignmentSubmit', () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  // REGRESSION: a failed prior-submission lookup must render an error state
  // with retry instead of the form — submitting blind would INSERT a
  // duplicate submission row.
  it('renders an error state and no form when the submission lookup fails', async () => {
    const submissionsBuilder = makeTableBuilder({
      data: null,
      error: { message: 'submissions unavailable' },
    });
    useTables({
      assignment_submissions: submissionsBuilder,
      assignment_rubrics: makeTableBuilder({ data: [], error: null }),
    });

    render(<InlineAssignmentSubmit item={item} assignment={assignment} />);

    expect(
      await screen.findByText("Couldn't load your submission"),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // The form (and thus any path to a duplicate insert) is withheld.
    expect(
      screen.queryByRole('button', { name: /submit assignment/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Submit your work')).not.toBeInTheDocument();
    expect(submissionsBuilder.insert).not.toHaveBeenCalled();
  });

  it('treats a missing max_attempts as unlimited instead of inventing a 3-attempt limit', async () => {
    useTables({
      assignment_submissions: makeTableBuilder({
        data: makeSubmission({
          assignment_id: 'assignment-1',
          workflow_state: 'submitted',
          attempt: 3,
        }),
        error: null,
      }),
      assignment_rubrics: makeTableBuilder({ data: [], error: null }),
    });

    render(<InlineAssignmentSubmit item={item} assignment={assignment} />);

    // Attempt count shown without a fabricated "of 3" cap.
    expect(await screen.findByText(/Attempt 3/)).toBeInTheDocument();
    expect(screen.queryByText(/Attempt 3 of/)).not.toBeInTheDocument();
    // Resubmission is still allowed at attempt 3 (no invented cutoff).
    expect(screen.getByRole('button', { name: /resubmit/i })).toBeEnabled();
    expect(
      screen.queryByText(/reached the maximum/i),
    ).not.toBeInTheDocument();
  });

  it('shows an inline rubric-unavailable notice when the rubric criteria load fails', async () => {
    useTables({
      assignment_submissions: makeTableBuilder({
        data: makeSubmission({
          assignment_id: 'assignment-1',
          workflow_state: 'graded',
          attempt: 1,
        }),
        error: null,
      }),
      assignment_rubrics: makeTableBuilder({
        data: [{ rubric_id: 'rubric-1' }],
        error: null,
      }),
      rubric_criteria: makeTableBuilder({
        data: null,
        error: { message: 'criteria unavailable' },
      }),
    });

    render(<InlineAssignmentSubmit item={item} assignment={assignment} />);

    expect(
      await screen.findByText(/rubric unavailable/i),
    ).toBeInTheDocument();
  });
});
