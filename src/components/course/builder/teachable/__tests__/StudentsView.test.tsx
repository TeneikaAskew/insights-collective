// ABOUTME: Tests for the builder Students roster — course scoping, empty/error states, search, sort, links.
// ABOUTME: Supabase is mocked to mirror enrollments_staff_select (instructor of the course or admin only).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@/test/utils/test-utils';
import { StudentsView } from '../StudentsView';
import { filterAndSortRoster, isNotStarted } from '@/services/courseRosterService';

const state = vi.hoisted(() => ({
  caller: 'inst-a',
  fail: null as string | null,
}));

const ENROLLMENTS = [
  { course_id: 'course-a', user_id: 'u1', enrolled_at: '2026-01-10T00:00:00Z', completion_status: 80 },
  { course_id: 'course-a', user_id: 'u2', enrolled_at: '2026-03-01T00:00:00Z', completion_status: 0 },
  { course_id: 'course-a', user_id: 'u3', enrolled_at: '2026-02-01T00:00:00Z', completion_status: 0 },
  { course_id: 'course-b', user_id: 'u9', enrolled_at: '2026-02-01T00:00:00Z', completion_status: 50 },
];
const PROFILES = [
  { id: 'u1', first_name: 'Ada', last_name: 'Lovelace', avatar_url: null },
  { id: 'u2', first_name: 'Grace', last_name: 'Hopper', avatar_url: null },
  { id: 'u3', first_name: 'Alan', last_name: 'Turing', avatar_url: null },
  { id: 'u9', first_name: 'Other', last_name: 'Learner', avatar_url: null },
];
const INSTRUCTOR_OF: Record<string, string> = { 'course-a': 'inst-a', 'course-b': 'inst-b' };

vi.mock('@/integrations/supabase/client', () => {
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: unknown) => { filters[col] = val; return builder; },
      in: (col: string, vals: unknown[]) => { filters[col] = vals; return builder; },
      then: (resolve: (v: unknown) => void) => {
        if (state.fail) return resolve({ data: null, error: { message: state.fail } });
        if (table === 'enrollments') {
          // RLS: own rows, or staff of the row's course.
          const rows = ENROLLMENTS.filter(
            (e) => e.course_id === filters.course_id &&
              (e.user_id === state.caller || INSTRUCTOR_OF[e.course_id] === state.caller),
          );
          return resolve({ data: rows, error: null });
        }
        const ids = (filters.id as string[]) || [];
        return resolve({ data: PROFILES.filter((p) => ids.includes(p.id)), error: null });
      },
    };
    return builder;
  };
  return { supabase: { from } };
});

const renderView = (courseId = 'course-a') =>
  render(<StudentsView courseId={courseId} courseTitle="Data 101" />);

beforeEach(() => { state.caller = 'inst-a'; state.fail = null; });

describe('StudentsView', () => {
  it('shows only the learners of the instructor\'s own course', async () => {
    renderView();
    const list = await screen.findByRole('list', { name: /enrolled students/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText('Other Learner')).not.toBeInTheDocument();
  });

  it('another instructor sees no learners for a course they do not teach', async () => {
    state.caller = 'inst-b';
    renderView('course-a');
    expect(await screen.findByText(/no students yet/i)).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('a student never sees classmates', async () => {
    state.caller = 'u1';
    renderView('course-a');
    const list = await screen.findByRole('list', { name: /enrolled students/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
  });

  it('shows an error with retry when the backend fails, not an empty roster', async () => {
    state.fail = 'permission denied';
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission denied/);
    expect(screen.queryByText(/no students yet/i)).not.toBeInTheDocument();
    state.fail = null;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
  });

  it('search filters by name and links each learner to the gradebook', async () => {
    renderView();
    await screen.findByText('Ada Lovelace');
    fireEvent.change(screen.getByLabelText(/search students/i), { target: { value: 'grace' } });
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: /view grades for grace hopper/i });
    expect(link).toHaveAttribute('href', '/courses/course-a/gradebook');
  });
});

describe('roster helpers', () => {
  const now = new Date('2026-03-05T00:00:00Z');
  const base = [
    { userId: 'a', name: 'Ada', avatarUrl: null, enrolledAt: '2026-01-10T00:00:00Z', progress: 80, needsAttention: false },
    { userId: 'b', name: 'Grace', avatarUrl: null, enrolledAt: '2026-03-01T00:00:00Z', progress: 0, needsAttention: false },
    { userId: 'c', name: 'Alan', avatarUrl: null, enrolledAt: '2026-02-01T00:00:00Z', progress: 0, needsAttention: true },
  ];
  it('sorts by progress and enrollment date', () => {
    expect(filterAndSortRoster(base, '', 'progress_desc').map((l) => l.userId)[0]).toBe('a');
    expect(filterAndSortRoster(base, '', 'enrolled_desc').map((l) => l.userId)).toEqual(['b', 'c', 'a']);
    expect(filterAndSortRoster(base, '', 'enrolled_asc').map((l) => l.userId)).toEqual(['a', 'c', 'b']);
  });
  it('flags 0% only after 7 days enrolled', () => {
    expect(isNotStarted(0, '2026-03-01T00:00:00Z', now)).toBe(false);
    expect(isNotStarted(0, '2026-02-25T00:00:00Z', now)).toBe(true);
    expect(isNotStarted(5, '2026-01-01T00:00:00Z', now)).toBe(false);
    expect(filterAndSortRoster(base, '', 'name_asc', true).map((l) => l.userId)).toEqual(['c']);
  });
});
