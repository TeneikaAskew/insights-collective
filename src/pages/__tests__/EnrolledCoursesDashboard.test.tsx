// ABOUTME: Tests for EnrolledCoursesDashboard covering loading/success/empty/error states,
// ABOUTME: the inline sidebar error, and regressions for fabricated values (status badge, module counts, stock thumbnail).
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import { useAuth } from '@/contexts/AuthContext';
import EnrolledCoursesDashboard from '@/pages/EnrolledCoursesDashboard';

// Keep the page under test isolated from the app shell.
vi.mock('@/components/layout/AppLayout', () => ({
  default: (props: { children?: React.ReactNode }) => props.children,
}));

type TableResult = { data: unknown; error: { message: string } | null };

// Builds a chainable, thenable query builder that resolves to `result`.
// 'pending' produces a builder whose promise never settles (loading state).
function tableBuilder(result: TableResult | 'pending') {
  const builder: any = {};
  for (const m of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not', 'or',
    'order', 'limit', 'filter', 'match', 'contains',
  ]) {
    builder[m] = vi.fn(() => builder);
  }
  if (result === 'pending') {
    builder.single = vi.fn(() => new Promise(() => undefined));
    builder.maybeSingle = vi.fn(() => new Promise(() => undefined));
    builder.then = () => undefined; // never settles
  } else {
    const first = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
    builder.single = vi.fn().mockResolvedValue({ data: first, error: result.error });
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: first, error: result.error });
    builder.then = (onFulfilled: any, onRejected: any) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
  }
  return builder;
}

function mockTables(tables: Record<string, TableResult | 'pending'>) {
  (mockSupabaseClient.from as Mock).mockImplementation((table: string) =>
    tableBuilder(tables[table] ?? { data: [], error: null }),
  );
}

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const enrollmentRow = {
  course_id: 'course-1',
  completion_status: 42,
  enrolled_at: '2026-01-05T00:00:00Z',
  courses: {
    id: 'course-1',
    title: 'Intro to Data Analytics',
    category: 'Data',
    level: 'Beginner',
    thumbnail: null,
    image_url: null,
    instructor_id: 'instructor-1',
    profiles: { first_name: 'Ada', last_name: 'Lovelace' },
  },
};

const assignmentRow = {
  course_id: 'course-1',
  title: 'Essay 1',
  due_date: futureDate,
  courses: { title: 'Intro to Data Analytics' },
};

const progressionRow = {
  workflow_state: 'completed',
  updated_at: '2026-01-10T00:00:00Z',
  content_items: {
    title: 'Lesson 1',
    course_id: 'course-1',
    courses: { title: 'Intro to Data Analytics' },
  },
};

const successTables = (): Record<string, TableResult> => ({
  enrollments: { data: [enrollmentRow], error: null },
  assignments: { data: [assignmentRow], error: null },
  content_item_progressions: { data: [progressionRow], error: null },
});

describe('EnrolledCoursesDashboard', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({
        user: { id: 'user-1', email: 'student@example.com' },
        isAuthenticated: true,
      }) as any,
    );
  });

  it('renders the loading skeleton while enrollments are fetching', () => {
    mockTables({ enrollments: 'pending' });
    const { container } = render(<EnrolledCoursesDashboard />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('My Courses')).not.toBeInTheDocument();
  });

  it('renders enrolled courses with real data on success', async () => {
    mockTables(successTables());
    render(<EnrolledCoursesDashboard />);

    expect(await screen.findAllByText('Intro to Data Analytics')).not.toHaveLength(0);
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('Instructor: Ada Lovelace')).toBeInTheDocument();
    // Sidebar success data
    expect(await screen.findByText('Completed: Lesson 1')).toBeInTheDocument();
    expect(screen.getByText('Essay 1')).toBeInTheDocument();
  });

  it('does not fabricate a status badge or module counts', async () => {
    mockTables(successTables());
    render(<EnrolledCoursesDashboard />);

    await screen.findAllByText('Intro to Data Analytics');

    // No hardcoded enrollment status badge
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    // No "X/Y modules" derived from a single percentage
    expect(screen.queryByText(/\d+\/\d+ modules/)).not.toBeInTheDocument();
  });

  it('covers a course with app-owned artwork, never a remote stock image', async () => {
    mockTables(successTables());
    const { container } = render(<EnrolledCoursesDashboard />);

    await screen.findAllByText('Intro to Data Analytics');

    // This assertion used to require no <img> at all for a course with no
    // thumbnail. `CourseImage` now falls back to one of three bundled covers
    // chosen by hashing the title, so the rule it enforces has changed: the
    // artwork must be ours and bundled, never fetched from a stock service.
    // That is the part worth guarding — a remote cover is an outbound request
    // on every card and an image nobody in this repo controls.
    expect(container.innerHTML).not.toContain('unsplash');

    const images = Array.from(container.querySelectorAll('img'));
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      const src = img.getAttribute('src') ?? '';
      expect(src, `${src} is not a bundled asset`).not.toMatch(/^https?:\/\//);
      expect(src).toMatch(/course-cover-(collaboration|leadership|strategy)/);
      // A decorative cover still needs an accessible name for the card.
      expect(img.getAttribute('alt')).toBeTruthy();
    }
  });

  it('omits the instructor line when the instructor is unknown', async () => {
    mockTables({
      ...successTables(),
      enrollments: {
        data: [{ ...enrollmentRow, courses: { ...enrollmentRow.courses, profiles: null } }],
        error: null,
      },
    });
    render(<EnrolledCoursesDashboard />);

    await screen.findAllByText('Intro to Data Analytics');
    expect(screen.queryByText(/Instructor:/)).not.toBeInTheDocument();
  });

  it('shows the empty state when the user has no enrollments', async () => {
    mockTables({ enrollments: { data: [], error: null } });
    render(<EnrolledCoursesDashboard />);

    expect(await screen.findByText('No Enrolled Courses')).toBeInTheDocument();
  });

  it('renders an error state (not just a toast) when the main fetch fails, and retries', async () => {
    mockTables({ enrollments: { data: null, error: { message: 'enrollments exploded' } } });
    render(<EnrolledCoursesDashboard />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error loading courses')).toBeInTheDocument();
    expect(screen.getByText('enrollments exploded')).toBeInTheDocument();
    // Failure must not masquerade as an empty list
    expect(screen.queryByText('No Enrolled Courses')).not.toBeInTheDocument();

    // Retry refetches and renders the courses
    mockTables(successTables());
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findAllByText('Intro to Data Analytics')).not.toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders an inline sidebar error while the main course list still renders', async () => {
    mockTables({
      ...successTables(),
      content_item_progressions: { data: null, error: { message: 'sidebar down' } },
    });
    render(<EnrolledCoursesDashboard />);

    // Main list unaffected
    expect(await screen.findAllByText('Intro to Data Analytics')).not.toHaveLength(0);
    // Sidebar shows its own inline error
    expect(await screen.findByText('Error loading activity')).toBeInTheDocument();
    expect(screen.getByText('sidebar down')).toBeInTheDocument();
    // The main-fetch error state is NOT shown
    expect(screen.queryByText('Error loading courses')).not.toBeInTheDocument();

    // Sidebar retry recovers
    mockTables(successTables());
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Completed: Lesson 1')).toBeInTheDocument();
    expect(screen.queryByText('Error loading activity')).not.toBeInTheDocument();
  });

  it('shows empty copy in the sidebar when there is no activity or deadlines', async () => {
    mockTables({
      enrollments: { data: [enrollmentRow], error: null },
      assignments: { data: [], error: null },
      content_item_progressions: { data: [], error: null },
    });
    render(<EnrolledCoursesDashboard />);

    await screen.findAllByText('Intro to Data Analytics');
    await waitFor(() => {
      expect(screen.getByText('No recent activity yet.')).toBeInTheDocument();
      expect(screen.getByText('No upcoming deadlines.')).toBeInTheDocument();
    });
  });
});
