// ABOUTME: Tests for the InstructorAssignments page — permission gate, loading,
// ABOUTME: loaded assignment rows with counts, empty list, and query failure.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import InstructorAssignments from '../InstructorAssignments';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { mockSupabaseClient } from '@/test/mocks/supabase';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: 'course-1' }),
  };
});

vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="course-layout">{children}</div>
  ),
}));

vi.mock('@/hooks/useCoursePermissions', () => ({
  useCoursePermissions: vi.fn(),
}));

// Chainable, awaitable query builder that resolves to `result` no matter which
// filter methods the page chains before awaiting.
function tableResult(result: any) {
  const builder: any = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

function wireTables(tables: Record<string, any | any[]>) {
  const queues: Record<string, any[]> = {};
  for (const [name, value] of Object.entries(tables)) {
    queues[name] = Array.isArray(value) ? [...value] : [value];
  }
  (mockSupabaseClient.from as any).mockImplementation((table: string) => {
    const queue = queues[table];
    if (queue && queue.length > 0) {
      return queue.length > 1 ? queue.shift() : queue[0];
    }
    return tableResult({ data: [], error: null, count: 0 });
  });
}

function grantPermissions({ canManage = true, loading = false } = {}) {
  vi.mocked(useCoursePermissions).mockReturnValue({
    canEdit: canManage,
    isInstructor: canManage,
    isAdmin: false,
    loading,
    error: null,
  } as any);
}

describe('InstructorAssignments', () => {
  beforeEach(() => {
    grantPermissions();
  });

  it('shows a loading state while permissions load', () => {
    grantPermissions({ loading: true });

    render(<InstructorAssignments />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('gates the page behind instructor access', () => {
    grantPermissions({ canManage: false });

    render(<InstructorAssignments />);

    expect(screen.getByText('You need instructor access to view this page.')).toBeInTheDocument();
    expect(screen.queryByText('Assignments')).not.toBeInTheDocument();
  });

  it('renders assignments with submission counts on success', async () => {
    wireTables({
      assignments: tableResult({
        data: [
          {
            id: 'a1',
            title: 'Essay 1: Data Cleaning',
            due_date: '2026-08-01T00:00:00Z',
            points_possible: 100,
            content_item_id: 'ci-1',
          },
        ],
        error: null,
      }),
      enrollments: tableResult({ data: null, error: null, count: 10 }),
      // First query counts submitted, second counts graded
      assignment_submissions: [
        tableResult({ data: null, error: null, count: 4 }),
        tableResult({ data: null, error: null, count: 2 }),
      ],
    });

    render(<InstructorAssignments />);

    await waitFor(() => {
      expect(screen.getByText('Essay 1: Data Cleaning')).toBeInTheDocument();
    });
    expect(screen.getByText('4 submitted')).toBeInTheDocument();
    expect(screen.getByText('2 graded')).toBeInTheDocument();
    expect(screen.getByText('2 pending')).toBeInTheDocument();
    expect(screen.getByText('6 missing')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Grade submissions/i })).toHaveAttribute(
      'href',
      '/courses/course-1/assignments/ci-1/grade',
    );
  });

  it('shows the empty state when the course has no assignments', async () => {
    wireTables({
      assignments: tableResult({ data: [], error: null }),
      enrollments: tableResult({ data: null, error: null, count: 0 }),
    });

    render(<InstructorAssignments />);

    await waitFor(() => {
      expect(
        screen.getByText('No assignments have been created in this course yet.'),
      ).toBeInTheDocument();
    });
  });

  it('settles without crashing when the assignments query fails', async () => {
    // NOTE: the page currently coalesces a failed response (data: null) into an
    // empty list, so a backend failure renders the empty-state copy. This test
    // documents that behavior and guards against an infinite loading state.
    wireTables({
      assignments: tableResult({
        data: null,
        error: { message: 'connection refused', code: 'PGRST000' },
      }),
      enrollments: tableResult({ data: null, error: null, count: 0 }),
    });

    render(<InstructorAssignments />);

    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });
    expect(
      screen.getByText('No assignments have been created in this course yet.'),
    ).toBeInTheDocument();
  });
});
