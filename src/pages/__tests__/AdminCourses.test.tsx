// ABOUTME: Tests for the AdminCourses page — course grid load/empty/error and the
// ABOUTME: certificates tab (real query data, load-error toast, revoke flow, revoke error).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import AdminCourses from '../AdminCourses';
import { useAuth } from '@/contexts/AuthContext';
import { mockSupabaseClient } from '@/test/mocks/supabase';

const toastSpy = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
  toast: toastSpy,
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/admin/CourseProgressDashboard', () => ({
  CourseProgressDashboard: () => <div data-testid="course-progress-dashboard" />,
}));

vi.mock('@/hooks/useCourseEnrollments', () => ({
  useCourseEnrollments: vi.fn(() => ({ enrollments: [], stats: null, loading: false })),
}));

// Hint needs a TooltipProvider ancestor; bypass it entirely in tests.
vi.mock('@/components/ui/hint', () => ({
  Hint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Chainable, awaitable query builder resolving to `result`.
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

function pendingTable() {
  const builder = tableResult({ data: null, error: null });
  builder.then = () => new Promise(() => undefined);
  return builder;
}

// Values may be a single builder (reused for every call) or an array queue
// (consumed call-by-call, last entry reused thereafter).
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

const courseRow = {
  id: 'course-1',
  title: 'Intro to Data Analytics',
  description: 'Learn the basics of data analytics.',
  category: 'Data',
  level: 'Beginner',
  published: true,
  status: 'published',
  enrollment_status: 'open',
  image_url: null,
  thumbnail: null,
  tags: [],
  instructor_id: 'instructor-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  instructor: {
    id: 'instructor-1',
    first_name: 'Grace',
    last_name: 'Hopper',
    avatar_url: null,
  },
};

const certificateRow = {
  id: 'cert-1',
  user_id: 'student-1',
  course_id: 'course-1',
  certificate_type: 'completion',
  issued_at: '2026-02-01T00:00:00Z',
  verification_code: 'CERT-ABCD-1234',
  profiles: { first_name: 'Ada', last_name: 'Lovelace' },
};

function wireHappyCoursesLoad(extra: Record<string, any | any[]> = {}) {
  wireTables({
    courses: tableResult({ data: [courseRow], error: null }),
    enrollments: tableResult({
      data: [{ course_id: 'course-1' }, { course_id: 'course-1' }],
      error: null,
    }),
    user_roles: tableResult({ data: [{ role: 'admin' }], error: null }),
    ...extra,
  });
}

async function openCertificatesTab(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: /Certificates/i })).toBeInTheDocument();
  });
  await user.click(screen.getByRole('tab', { name: /Certificates/i }));
}

describe('AdminCourses', () => {
  beforeEach(() => {
    toastSpy.mockClear();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'admin-1' },
      session: null,
      loading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      googleSignIn: vi.fn(),
      githubSignIn: vi.fn(),
      twitterSignIn: vi.fn(),
      isAuthenticated: true,
      isAdmin: true,
      isAdminAuthenticated: true,
      storeRedirectPath: vi.fn(),
      handleRedirectAfterLogin: vi.fn(),
    } as any);
  });

  describe('courses tab', () => {
    it('shows a spinner while courses load', () => {
      wireTables({ courses: pendingTable() });

      render(<AdminCourses />);

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('renders the loaded course cards with enrollment counts', async () => {
      wireHappyCoursesLoad();

      render(<AdminCourses />);

      await waitFor(() => {
        expect(screen.getByText('Intro to Data Analytics')).toBeInTheDocument();
      });
      expect(screen.getByText('Learn the basics of data analytics.')).toBeInTheDocument();
      expect(screen.getByText('2 enrolled')).toBeInTheDocument();
      expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
      expect(screen.getByText('Published')).toBeInTheDocument();
      expect(screen.queryByText('No courses yet')).not.toBeInTheDocument();
    });

    it('shows the empty state when there are no courses', async () => {
      wireTables({
        courses: tableResult({ data: [], error: null }),
        user_roles: tableResult({ data: [{ role: 'admin' }], error: null }),
      });

      render(<AdminCourses />);

      await waitFor(() => {
        expect(screen.getByText('No courses yet')).toBeInTheDocument();
      });
      expect(screen.getByText('Get started by creating your first course.')).toBeInTheDocument();
    });

    it('surfaces a destructive toast when the courses query fails', async () => {
      wireTables({
        courses: tableResult({
          data: null,
          error: { message: 'connection refused', code: 'PGRST000' },
        }),
      });

      render(<AdminCourses />);

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to fetch courses',
            variant: 'destructive',
          }),
        );
      });
    });

    it('REGRESSION: a failed courses query renders an error + retry, not "No courses yet"', async () => {
      wireTables({
        courses: tableResult({
          data: null,
          error: { message: 'connection refused', code: 'PGRST000' },
        }),
      });

      render(<AdminCourses />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load courses')).toBeInTheDocument();
      });
      expect(screen.getByText('connection refused')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      // The failure must be visibly distinct from an empty catalog.
      expect(screen.queryByText('No courses yet')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Get started by creating your first course.'),
      ).not.toBeInTheDocument();
    });

    it('retries the courses fetch when the error-state Retry button is clicked', async () => {
      const failingCourses = tableResult({
        data: null,
        error: { message: 'connection refused', code: 'PGRST000' },
      });
      const okCourses = tableResult({ data: [courseRow], error: null });
      wireTables({
        courses: [failingCourses, okCourses],
        enrollments: tableResult({ data: [{ course_id: 'course-1' }], error: null }),
        user_roles: tableResult({ data: [{ role: 'admin' }], error: null }),
      });

      render(<AdminCourses />);

      const retry = await screen.findByRole('button', { name: /retry/i });
      fireEvent.click(retry);

      await waitFor(() => {
        expect(screen.getByText('Intro to Data Analytics')).toBeInTheDocument();
      });
      expect(screen.queryByText('Failed to load courses')).not.toBeInTheDocument();
    });
  });

  describe('certificates tab', () => {
    it('renders real certificate rows from the certificates query', async () => {
      const user = userEvent.setup();
      wireHappyCoursesLoad({
        certificates: tableResult({ data: [certificateRow], error: null }),
      });

      render(<AdminCourses />);
      await openCertificatesTab(user);

      await waitFor(() => {
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
      });
      expect(screen.getByText('CERT-ABCD-1234')).toBeInTheDocument();
      expect(screen.getByText('completion')).toBeInTheDocument();
      // REGRESSION: no hard-coded mock certificate data anywhere
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('shows a destructive toast and no rows when the certificates query fails', async () => {
      const user = userEvent.setup();
      wireHappyCoursesLoad({
        certificates: tableResult({
          data: null,
          error: { message: 'RLS says no', code: 'PGRST301' },
        }),
      });

      render(<AdminCourses />);
      await openCertificatesTab(user);

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to load certificates',
            description: 'RLS says no',
            variant: 'destructive',
          }),
        );
      });
      expect(
        screen.getByText('No certificates issued for this course yet.'),
      ).toBeInTheDocument();
    });

    it('revokes a certificate through the confirm dialog via a real delete call', async () => {
      const user = userEvent.setup();
      // count: 1 — the revoke actually deleted a row (admin/instructor policy).
      const deleteBuilder = tableResult({ data: null, error: null, count: 1 });
      wireHappyCoursesLoad({
        certificates: [
          tableResult({ data: [certificateRow], error: null }), // initial load
          deleteBuilder, // revoke delete
        ],
      });

      render(<AdminCourses />);
      await openCertificatesTab(user);

      const row = (await screen.findByText('Ada Lovelace')).closest('tr') as HTMLElement;
      const buttons = within(row).getAllByRole('button');
      // Last button in the row is the icon-only revoke (trash) trigger
      await user.click(buttons[buttons.length - 1]);

      const revokeButton = await screen.findByRole('button', { name: 'Revoke' });
      fireEvent.click(revokeButton);

      await waitFor(() => {
        expect(deleteBuilder.delete).toHaveBeenCalled();
      });
      expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'cert-1');
      await waitFor(() => {
        expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
      });
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Certificate revoked',
          variant: 'destructive',
        }),
      );
    });

    it('surfaces a revoke failure and keeps the certificate row', async () => {
      const user = userEvent.setup();
      const deleteBuilder = tableResult({
        data: null,
        error: { message: 'delete denied', code: 'PGRST301' },
      });
      wireHappyCoursesLoad({
        certificates: [
          tableResult({ data: [certificateRow], error: null }), // initial load
          deleteBuilder, // failing revoke delete
        ],
      });

      render(<AdminCourses />);
      await openCertificatesTab(user);

      const row = (await screen.findByText('Ada Lovelace')).closest('tr') as HTMLElement;
      const buttons = within(row).getAllByRole('button');
      await user.click(buttons[buttons.length - 1]);

      const revokeButton = await screen.findByRole('button', { name: 'Revoke' });
      fireEvent.click(revokeButton);

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Revoke failed',
            description: 'delete denied',
            variant: 'destructive',
          }),
        );
      });
      // The row must not be optimistically removed on a failed delete
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });

    it('treats a zero-row delete as a failure instead of false success', async () => {
      const user = userEvent.setup();
      // No error, but count: 0 — RLS matched no rows (e.g. missing admin DELETE
      // policy). This previously reported false success and dropped the row.
      const deleteBuilder = tableResult({ data: null, error: null, count: 0 });
      wireHappyCoursesLoad({
        certificates: [
          tableResult({ data: [certificateRow], error: null }), // initial load
          deleteBuilder, // 0-row revoke delete
        ],
      });

      render(<AdminCourses />);
      await openCertificatesTab(user);

      const row = (await screen.findByText('Ada Lovelace')).closest('tr') as HTMLElement;
      const buttons = within(row).getAllByRole('button');
      await user.click(buttons[buttons.length - 1]);

      const revokeButton = await screen.findByRole('button', { name: 'Revoke' });
      fireEvent.click(revokeButton);

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Revoke failed',
            variant: 'destructive',
          }),
        );
      });
      // Row stays because nothing was actually deleted.
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });
  });
});
