// ABOUTME: Tests for the builder Students roster — course scoping, empty/error states, search, sort, links.
// ABOUTME: Supabase is faked with RLS-like visibility for enrollments and progressions (course instructor or self).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@/test/utils/test-utils';
import { StudentsView } from '../StudentsView';
import { filterAndSortRoster, isNotStarted } from '@/services/courseRosterService';

const state = vi.hoisted(() => ({
  caller: 'inst-a',
  db: null as any,
}));

// completion_status is deliberately inconsistent with progressions: progress must come from progressions.
const ENROLLMENTS = [
  { course_id: 'course-a', user_id: 'u1', enrolled_at: '2026-01-10T00:00:00Z', completion_status: 0 },
  { course_id: 'course-a', user_id: 'u2', enrolled_at: '2026-03-01T00:00:00Z', completion_status: 90 },
  { course_id: 'course-a', user_id: 'u3', enrolled_at: '2026-02-01T00:00:00Z', completion_status: 0 },
  { course_id: 'course-b', user_id: 'u9', enrolled_at: '2026-02-01T00:00:00Z', completion_status: 50 },
];
const PROFILES = [
  { id: 'u1', first_name: 'Ada', last_name: 'Lovelace', avatar_url: null },
  { id: 'u2', first_name: 'Grace', last_name: 'Hopper', avatar_url: null },
  { id: 'u3', first_name: 'Alan', last_name: 'Turing', avatar_url: null },
  { id: 'u9', first_name: 'Other', last_name: 'Learner', avatar_url: null },
];
const MODULES = [{ id: 'm1', course_id: 'course-a', title: 'One', position: 1, published: true }];
const ITEMS = [
  { id: 'i1', module_id: 'm1', type: 'page', title: 'a', published: true },
  { id: 'i2', module_id: 'm1', type: 'page', title: 'b', published: true },
  { id: 'i3', module_id: 'm1', type: 'page', title: 'c', published: true },
  { id: 'i4', module_id: 'm1', type: 'page', title: 'd', published: true },
  { id: 'i5', module_id: 'm1', type: 'page', title: 'e', published: true },
];
// u1 finished 4 of 5 (80%); u2 and u3 nothing.
const PROGRESSIONS = ['i1', 'i2', 'i3', 'i4'].map((id) => ({ user_id: 'u1', content_item_id: id, workflow_state: 'completed' }));
const INSTRUCTOR_OF: Record<string, string> = { 'course-a': 'inst-a', 'course-b': 'inst-b' };
const ENROLLED_IN: Record<string, string> = { u1: 'course-a', u2: 'course-a', u3: 'course-a', u9: 'course-b' };

vi.mock('@/integrations/supabase/client', async () => {
  const { makeFakeClient } = await import('@/services/__tests__/fakeRosterSupabase');
  return { supabase: { from: (t: string) => makeFakeClient(state.db).from(t) } };
});

async function freshDb() {
  const { makeFakeDb } = await import('@/services/__tests__/fakeRosterSupabase');
  const db = makeFakeDb({
    enrollments: ENROLLMENTS,
    profiles: PROFILES,
    modules: MODULES,
    content_items: ITEMS,
    content_item_progressions: PROGRESSIONS,
  });
  // RLS: own rows, or staff of the row's course.
  db.visible = {
    enrollments: (e: any) => e.user_id === state.caller || INSTRUCTOR_OF[e.course_id] === state.caller,
    content_item_progressions: (p: any) =>
      p.user_id === state.caller || INSTRUCTOR_OF[ENROLLED_IN[p.user_id]] === state.caller,
  };
  return db;
}

const renderView = (courseId = 'course-a') =>
  render(<StudentsView courseId={courseId} courseTitle="Data 101" />);

beforeEach(async () => { state.caller = 'inst-a'; state.db = await freshDb(); });

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
    state.db.fail = 'permission denied';
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission denied/);
    expect(screen.queryByText(/no students yet/i)).not.toBeInTheDocument();
    state.db.fail = null;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
  });

  it('shows progress from progression evidence, not enrollments.completion_status (T-15)', async () => {
    renderView();
    await screen.findByText('Ada Lovelace');
    const rows = within(screen.getByRole('list', { name: /enrolled students/i })).getAllByRole('listitem');
    const ada = rows.find((r) => within(r).queryByText('Ada Lovelace'))!;
    const grace = rows.find((r) => within(r).queryByText('Grace Hopper'))!;
    expect(within(ada).getByText('80%')).toBeInTheDocument();
    expect(within(grace).getByText('0%')).toBeInTheDocument();
    expect(within(grace).queryByText('90%')).not.toBeInTheDocument();
    expect(screen.getByTestId('roster-avg-progress')).toHaveTextContent('27%');
  });

  it('shows unknown progress as a dash when the course has no published lessons', async () => {
    state.db.tables.content_items = [];
    renderView();
    await screen.findByText('Ada Lovelace');
    expect(screen.getByTestId('roster-avg-progress')).toHaveTextContent('—');
    expect(screen.getByText(/no published lessons to measure yet/i)).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('Not started')).not.toBeInTheDocument();
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
    { userId: 'a', name: 'Ada', avatarUrl: null, enrolledAt: '2026-01-10T00:00:00Z', progress: 80, completedItems: 4, totalItems: 5, needsAttention: false },
    { userId: 'b', name: 'Grace', avatarUrl: null, enrolledAt: '2026-03-01T00:00:00Z', progress: 0, completedItems: 0, totalItems: 5, needsAttention: false },
    { userId: 'c', name: 'Alan', avatarUrl: null, enrolledAt: '2026-02-01T00:00:00Z', progress: 0, completedItems: 0, totalItems: 5, needsAttention: true },
  ];
  it('sorts by progress and enrollment date', () => {
    expect(filterAndSortRoster(base, '', 'progress_desc').map((l) => l.userId)[0]).toBe('a');
    expect(filterAndSortRoster(base, '', 'enrolled_desc').map((l) => l.userId)).toEqual(['b', 'c', 'a']);
    expect(filterAndSortRoster(base, '', 'enrolled_asc').map((l) => l.userId)).toEqual(['a', 'c', 'b']);
  });
  it('flags no finished lesson only after 7 days enrolled', () => {
    const none = { completedItems: 0, totalItems: 5 };
    expect(isNotStarted(none, '2026-03-01T00:00:00Z', now)).toBe(false);
    expect(isNotStarted(none, '2026-02-25T00:00:00Z', now)).toBe(true);
    expect(isNotStarted({ completedItems: 1, totalItems: 20 }, '2026-01-01T00:00:00Z', now)).toBe(false);
    expect(filterAndSortRoster(base, '', 'name_asc', true).map((l) => l.userId)).toEqual(['c']);
  });
});
