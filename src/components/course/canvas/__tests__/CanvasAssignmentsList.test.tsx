// Tests for the Canvas assignments list: success statuses, and the regression
// that a failed user-submissions query must NOT render fabricated
// "Missing"/"Not Submitted" badges — it suppresses badges and shows an
// inline error notice with retry instead.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeSubmission } from '@/test/utils/course-fixtures';
import { CanvasAssignmentsList } from '@/components/course/canvas/CanvasAssignmentsList';

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

const pastDue = '2020-01-01T00:00:00Z';

const assignmentItems = [
  {
    id: 'item-1',
    title: 'Overdue Homework',
    module_id: 'module-1',
    type: 'assignment',
    assignment: {
      id: 'assignment-1',
      points_possible: 50,
      due_at: pastDue,
      submission_types: ['online_text_entry'],
    },
    module: { id: 'module-1', title: 'Module 1', week: 1 },
  },
  {
    id: 'item-2',
    title: 'Second Homework',
    module_id: 'module-1',
    type: 'assignment',
    assignment: {
      id: 'assignment-2',
      points_possible: 20,
      due_at: null,
      submission_types: ['online_text_entry'],
    },
    module: { id: 'module-1', title: 'Module 1', week: 1 },
  },
];

describe('CanvasAssignmentsList', () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  it('renders real submission statuses on success', async () => {
    useTables({
      content_items: makeTableBuilder({ data: assignmentItems, error: null }),
      assignment_submissions: makeTableBuilder({
        data: [
          makeSubmission({
            assignment_id: 'assignment-1',
            workflow_state: 'submitted',
          }),
        ],
        error: null,
      }),
    });

    render(<CanvasAssignmentsList courseId="course-1" />);

    expect(await screen.findByText('Overdue Homework')).toBeInTheDocument();
    // Past-due assignment WITH a submission is "Submitted", not "Missing".
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.queryByText('Missing')).not.toBeInTheDocument();
    // Assignment without a submission and no due date is "Not Submitted".
    expect(screen.getByText('Not Submitted')).toBeInTheDocument();
  });

  // REGRESSION: a failed submissions query must NOT paint a false red
  // "Missing" badge on assignments the student may already have submitted.
  it('suppresses status badges and shows an error notice when the submissions query fails', async () => {
    useTables({
      content_items: makeTableBuilder({ data: assignmentItems, error: null }),
      assignment_submissions: makeTableBuilder({
        data: null,
        error: { message: 'submissions unavailable' },
      }),
    });

    render(<CanvasAssignmentsList courseId="course-1" />);

    expect(await screen.findByText('Overdue Homework')).toBeInTheDocument();
    // The inline error notice is visible with a retry affordance.
    expect(
      screen.getByText("Couldn't load your submission status"),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // No fabricated statuses of any kind.
    expect(screen.queryByText('Missing')).not.toBeInTheDocument();
    expect(screen.queryByText('Not Submitted')).not.toBeInTheDocument();
    expect(screen.queryByText('Submitted')).not.toBeInTheDocument();
    expect(screen.queryByText('Graded')).not.toBeInTheDocument();
  });

  it('retries loading submission statuses when Retry is clicked', async () => {
    const submissionsBuilder = makeTableBuilder(
      { data: null, error: { message: 'submissions unavailable' } },
      {
        data: [
          makeSubmission({
            assignment_id: 'assignment-1',
            workflow_state: 'submitted',
          }),
        ],
        error: null,
      },
    );
    useTables({
      content_items: makeTableBuilder({ data: assignmentItems, error: null }),
      assignment_submissions: submissionsBuilder,
    });

    render(<CanvasAssignmentsList courseId="course-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Submitted')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("Couldn't load your submission status"),
      ).not.toBeInTheDocument(),
    );
  });
});
