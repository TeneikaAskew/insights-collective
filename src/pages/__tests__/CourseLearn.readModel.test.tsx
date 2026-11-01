// ABOUTME: T-10 oracle for the CourseLearn page: one stored-progress read model behind the header, rail, home and
// ABOUTME: end-of-course surfaces; zero writes from navigation; certificate access only from an issued row.
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import CanvasContentService from '@/services/canvasContentService';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import CourseLearn from '@/pages/CourseLearn';
import { fakeCourseProgress, type FakeProgressOptions } from '@/test/mocks/courseProgressFake';

const { mockParams, mockNavigate, mockMark, perms } = vi.hoisted(() => ({
  mockParams: {} as { courseId?: string; moduleId?: string; itemId?: string },
  mockNavigate: vi.fn(),
  mockMark: vi.fn(),
  perms: { canEdit: false },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useParams: () => mockParams, useNavigate: () => mockNavigate };
});
vi.mock('@/hooks/useCourseProgress', () => ({ useCourseProgress: vi.fn() }));
vi.mock('@/services/canvasContentService', () => ({
  default: { getModules: vi.fn(), getContentItems: vi.fn() },
}));
vi.mock('@/hooks/useCoursePermissions', () => ({ useCoursePermissions: () => perms }));
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
vi.mock('@/components/onboarding/StudentLearnTour', () => ({ StudentLearnTour: () => null }));
vi.mock('@/components/course/learn/LessonViewer', () => ({ LessonViewer: () => null }));
vi.mock('@/components/ui/hint', () => ({ Hint: (props: { children?: React.ReactNode }) => props.children }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

// --- Supabase tables: every builder is recorded so a write of any kind is detectable ---
type TableResult = { data: unknown; error: { message: string; code?: string } | null };
const WRITE_METHODS = ['insert', 'update', 'delete', 'upsert'] as const;
const builders: Array<{ table: string; b: any }> = [];

function tableBuilder(result: TableResult) {
  const b: any = {};
  for (const m of ['select', ...WRITE_METHODS, 'eq', 'neq', 'in', 'is', 'not', 'or', 'order', 'limit', 'filter', 'match']) {
    b[m] = vi.fn(() => b);
  }
  const first = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
  b.single = vi.fn().mockResolvedValue({ data: first, error: result.error });
  b.maybeSingle = vi.fn().mockResolvedValue({ data: first, error: result.error });
  b.then = (ok: any, ko: any) => Promise.resolve(result).then(ok, ko);
  return b;
}

function mockTables(tables: Record<string, TableResult>) {
  (mockSupabaseClient.from as Mock).mockImplementation((table: string) => {
    const b = tableBuilder(tables[table] ?? { data: [], error: null });
    builders.push({ table, b });
    return b;
  });
}

function writeCalls() {
  return builders.flatMap(({ table, b }) =>
    WRITE_METHODS.filter((m) => (b[m] as Mock).mock.calls.length > 0).map((m) => `${table}.${m}`),
  );
}

// --- Fixture: six eligible items, plus draft/null items and modules the learner must never see or count ---
const ELIGIBLE = ['i1', 'i2', 'i3', 'q4', 'i5', 'i6'];

function setCurriculum() {
  vi.mocked(CanvasContentService.getModules).mockResolvedValue([
    { id: 'm1', title: 'Module One', published: true },
    { id: 'm2', title: 'Module Two', published: true },
    { id: 'mDraft', title: 'Draft Module', published: false },
    { id: 'mNull', title: 'Null Module', published: null },
  ] as any);
  vi.mocked(CanvasContentService.getContentItems).mockImplementation(async (moduleId: string) => {
    const byModule: Record<string, any[]> = {
      m1: [
        { id: 'i1', title: 'Lesson One', type: 'page', published: true },
        { id: 'i2', title: 'Graded Assignment', type: 'assignment', published: true },
        { id: 'i3', title: 'Lesson Three', type: 'page', published: true },
        { id: 'iDraft', title: 'Draft Lesson', type: 'page', published: false },
      ],
      m2: [
        { id: 'q4', title: 'Quiz Four', type: 'quiz', published: true },
        { id: 'i5', title: 'Lesson Five', type: 'page', published: true },
        { id: 'i6', title: 'Lesson Six', type: 'page', published: true },
        { id: 'iNull', title: 'Null Lesson', type: 'page', published: null },
      ],
      mDraft: [{ id: 'x1', title: 'Hidden In Draft Module', type: 'page', published: true }],
      mNull: [{ id: 'x2', title: 'Hidden In Null Module', type: 'page', published: true }],
    };
    return (byModule[moduleId] ?? []) as any;
  });
}

// i1 is read and i2 is graded in stored progress: two genuine DONE items.
function setProgress(overrides: Partial<FakeProgressOptions> = {}) {
  vi.mocked(useCourseProgress).mockImplementation(
    fakeCourseProgress({ eligible: ELIGIBLE, done: ['i1', 'i2'], mark: mockMark, modules: { m1: ['i1', 'i2', 'i3'], m2: ['q4', 'i5', 'i6'] }, ...overrides }) as any,
  );
}

const courseRow = { id: 'course-1', title: 'Advanced Testing', thumbnail: null };

function openItem(moduleId: string, itemId: string) {
  mockParams.moduleId = moduleId;
  mockParams.itemId = itemId;
}

const completion = () => screen.getByTestId('learn-completion');
const position = () => screen.getByTestId('learn-position');

/** The rail module counter ("2/3") under its "Section N · Title" heading. */
function railCount(sectionLabel: string) {
  const heading = screen.getAllByText(sectionLabel)[0];
  return heading.parentElement!.querySelector('div:last-child')!.textContent;
}

beforeEach(() => {
  mockParams.courseId = 'course-1';
  delete mockParams.moduleId;
  delete mockParams.itemId;
  perms.canEdit = false;
  mockNavigate.mockReset();
  mockMark.mockReset();
  mockMark.mockResolvedValue(undefined);
  builders.splice(0);
  setCurriculum();
  setProgress();
  mockTables({ courses: { data: courseRow, error: null }, certificates: { data: [], error: null } });
});

describe('CourseLearn read model (T-10)', () => {
  it('open quiz 4: position "Lesson 4 of 6" and completion 33% agree with the rail; drafts are absent', async () => {
    openItem('m2', 'q4');
    render(<CourseLearn />);

    expect(await screen.findByTestId('learn-position')).toHaveTextContent('Lesson 4 of 6');
    expect(completion()).toHaveTextContent('Course completion 33%');
    expect(railCount('Section 1 · Module One')).toBe('2/3');
    expect(railCount('Section 2 · Module Two')).toBe('0/3');
    for (const hidden of ['Draft Lesson', 'Null Lesson', 'Draft Module', 'Null Module', 'Hidden In Draft Module', 'Hidden In Null Module']) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    }
    expect(writeCalls()).toEqual([]);
  });

  it('course home: "6 lessons · Course completion 33%" and the accordion count use the same done set', async () => {
    render(<CourseLearn />);
    expect(await screen.findByText(/6 lessons · Course completion 33%/)).toBeInTheDocument();
    expect(screen.getByText('2 / 3 complete')).toBeInTheDocument();
    // The graded assignment is a genuine DONE item and is checked.
    const row = screen.getByText('Graded Assignment').closest('li')!;
    expect(within(row).getByLabelText('Completed')).toBeInTheDocument();
  });

  it('pure navigation (Prev, outline, arrow keys) and the assessed Continue make zero writes and stay at 33%', async () => {
    openItem('m2', 'q4');
    const user = userEvent.setup();
    render(<CourseLearn />);
    expect(await screen.findByTestId('learn-position')).toHaveTextContent('Lesson 4 of 6');

    await user.click(screen.getByRole('button', { name: /Previous Lesson/ }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/courses/course-1/learn/m1/i3');

    await user.click(screen.getAllByRole('button', { name: /Lesson Six/ })[0]);
    expect(mockNavigate).toHaveBeenLastCalledWith('/courses/course-1/learn/m2/i6');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(mockNavigate).toHaveBeenLastCalledWith('/courses/course-1/learn/m2/i5');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(mockNavigate).toHaveBeenLastCalledWith('/courses/course-1/learn/m1/i3');

    // Assessed item: Continue only navigates; the quiz is not completed by it.
    await user.click(screen.getAllByRole('button', { name: 'Continue to the next lesson without completing this one' })[0]);
    expect(mockNavigate).toHaveBeenLastCalledWith('/courses/course-1/learn/m2/i5');

    expect(mockMark).not.toHaveBeenCalled();
    expect(writeCalls()).toEqual([]);
    expect(completion()).toHaveTextContent('Course completion 33%');
    expect(railCount('Section 2 · Module Two')).toBe('0/3');
  });

  it('a refused write stays at 33% with no checkmark', async () => {
    openItem('m1', 'i3');
    mockMark.mockRejectedValue(new Error('denied'));
    const user = userEvent.setup();
    render(<CourseLearn />);
    expect(await screen.findByTestId('learn-position')).toHaveTextContent('Lesson 3 of 6');

    await user.click(screen.getAllByRole('button', { name: /Complete and Continue/ })[0]);
    await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1));
    expect(completion()).toHaveTextContent('Course completion 33%');
    expect(railCount('Section 1 · Module One')).toBe('2/3');
    // Unchanged existing behaviour, not asserted as a T-10 contract: a failed save toasts and still moves on.
  });

  it('informational Complete and Continue is the one intentional write: 3 of 6, 50% everywhere', async () => {
    openItem('m1', 'i3');
    const user = userEvent.setup();
    render(<CourseLearn />);
    expect(await screen.findByTestId('learn-position')).toHaveTextContent('Lesson 3 of 6');

    await user.click(screen.getAllByRole('button', { name: /Complete and Continue/ })[0]);
    await waitFor(() => expect(completion()).toHaveTextContent('Course completion 50%'));
    expect(mockMark).toHaveBeenCalledTimes(1);
    expect(mockMark).toHaveBeenCalledWith('i3');
    expect(railCount('Section 1 · Module One')).toBe('3/3');
    expect(mockNavigate).toHaveBeenLastCalledWith('/courses/course-1/learn/m2/q4');
    // The page itself issued no table writes; the only write path is the read model's markItemComplete.
    expect(writeCalls()).toEqual([]);
  });

  it('loading shows completion as unavailable, never 0%', async () => {
    openItem('m2', 'q4');
    setProgress({ loading: true });
    render(<CourseLearn />);
    expect(await screen.findByTestId('learn-completion')).toHaveTextContent('Course completion unavailable');
    expect(completion().textContent).not.toMatch(/\d+%/);
    expect(railCount('Section 1 · Module One')).toBe('—');
  });

  it('error shows completion as unavailable with the notice, and no number as current', async () => {
    openItem('m2', 'q4');
    setProgress({ error: 'progress fetch failed' });
    render(<CourseLearn />);
    expect(await screen.findByTestId('learn-completion')).toHaveTextContent('Course completion unavailable');
    expect(screen.getAllByText("Couldn't load your progress").length).toBeGreaterThan(0);
    expect(completion().textContent).not.toMatch(/\d+%/);
  });

  it('known 0 is a real 0%, distinct from unknown', async () => {
    openItem('m1', 'i1');
    setProgress({ done: [] });
    render(<CourseLearn />);
    expect(await screen.findByTestId('learn-completion')).toHaveTextContent('Course completion 0%');
  });

  it('near-100: 5 of 6 is 83%, and only 6 of 6 reads 100%', async () => {
    openItem('m2', 'i6');
    setProgress({ done: ['i1', 'i2', 'i3', 'q4', 'i5'] });
    const user = userEvent.setup();
    render(<CourseLearn />);
    expect(await screen.findByTestId('learn-completion')).toHaveTextContent('Course completion 83%');
    await user.click(screen.getAllByRole('button', { name: /Complete and Continue/ })[0]);
    await waitFor(() => expect(completion()).toHaveTextContent('Course completion 100%'));
    expect(mockNavigate).toHaveBeenLastCalledWith('/courses/course-1/learn/complete/summary');
  });

  it('edit mode shows no completion numbers (its outline includes drafts)', async () => {
    perms.canEdit = true;
    openItem('m1', 'i1');
    render(<CourseLearn />);
    expect(await screen.findByTestId('learn-completion')).toHaveTextContent('Course completion is not shown while editing');
    // Drafts are listed for the editor, and the position counts the editor's outline.
    expect(screen.getAllByText('Draft Lesson').length).toBeGreaterThan(0);
    expect(completion().textContent).not.toMatch(/\d+%/);
  });

  describe('T-10 A: a same-key refresh is unknown on every surface', () => {
    it('lesson view: held 33% is not shown; no checkmark, no rail count, no error notice', async () => {
      setProgress({ refreshing: true });
      openItem('m2', 'q4');
      render(<CourseLearn />);
      expect(await screen.findByTestId('learn-completion')).toHaveTextContent('Course completion unavailable');
      expect(completion().textContent).not.toMatch(/33%/);
      expect(railCount('Section 1 · Module One')).toBe('—');
      expect(railCount('Section 2 · Module Two')).toBe('—');
      expect(screen.queryByText("Couldn't load your progress")).not.toBeInTheDocument();
    });

    it('home: no counts, no done markers, no resume decision while refreshing', async () => {
      setProgress({ refreshing: true });
      render(<CourseLearn />);
      expect(await screen.findByText(/6 lessons · Course completion unavailable/)).toBeInTheDocument();
      expect(screen.queryByText(/\d+ \/ \d+ complete/)).not.toBeInTheDocument();
      expect(screen.queryAllByRole('img', { name: 'Completed' })).toHaveLength(0);
      expect(screen.queryByText(/^Resume:|Pick up where you left off/)).not.toBeInTheDocument();
      expect(screen.getByText(/^Open course:/)).toBeInTheDocument();
    });
  });

  describe('T-10 B: module figures come from the same snapshot, not the outline', () => {
    it('a module whose outline holds an item the snapshot does not count shows the snapshot figure', async () => {
      // The snapshot counts only i1 and i2 in m1 (i3 left the eligible set after the outline loaded); m2 unchanged.
      setProgress({ eligible: ['i1', 'i2', 'q4', 'i5', 'i6'], modules: { m1: ['i1', 'i2'], m2: ['q4', 'i5', 'i6'] } });
      openItem('m1', 'i1');
      render(<CourseLearn />);
      await screen.findByTestId('learn-completion');
      expect(railCount('Section 1 · Module One')).toBe('2/2'); // outline still lists 3 items; position is separate
      expect(railCount('Section 2 · Module Two')).toBe('0/3');
      expect(position()).toHaveTextContent('Lesson 1 of 6');
    });

    it('home accordion uses the snapshot denominators too', async () => {
      setProgress({ eligible: ['i1', 'i2', 'q4', 'i5', 'i6'], modules: { m1: ['i1', 'i2'], m2: ['q4', 'i5', 'i6'] } });
      render(<CourseLearn />);
      expect(await screen.findByText('2 / 2 complete')).toBeInTheDocument();
      expect(screen.getByText('0 / 3 complete')).toBeInTheDocument();
      expect(screen.queryByText('2 / 3 complete')).not.toBeInTheDocument();
    });

    it('a module missing from the snapshot shows no figure rather than an outline count', async () => {
      setProgress({ modules: { m1: ['i1', 'i2', 'i3'] } });
      openItem('m1', 'i1');
      render(<CourseLearn />);
      await screen.findByTestId('learn-completion');
      expect(railCount('Section 1 · Module One')).toBe('2/3');
      expect(railCount('Section 2 · Module Two')).toBe('—');
    });
  });

  describe('T-10 C: edit mode hides completion on EVERY surface; preview as student is the current viewer', () => {
    it('edit lesson view: no rail counts and no checkmarks even with stored progress', async () => {
      perms.canEdit = true;
      openItem('m1', 'i1');
      const { container } = render(<CourseLearn />);
      await screen.findByTestId('learn-completion');
      expect(railCount('Section 1 · Module One')).toBe('');
      expect(container.querySelectorAll('nav .lucide-circle-check-big, nav .lucide-check-circle-2, nav .lucide-circle-check').length).toBe(0);
      expect(screen.queryByText("Couldn't load your progress")).not.toBeInTheDocument();
    });

    it('edit home: no counts, no done markers, no resume decision', async () => {
      perms.canEdit = true;
      render(<CourseLearn />);
      expect((await screen.findAllByText(/Course completion is not shown while editing/)).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Completion not shown while editing').length).toBeGreaterThan(0);
      expect(screen.queryByText(/\d+ \/ \d+ complete/)).not.toBeInTheDocument();
      expect(screen.queryAllByRole('img', { name: 'Completed' })).toHaveLength(0);
      expect(screen.queryByText(/^Resume:/)).not.toBeInTheDocument();
    });

    it('edit to preview as student: the same surfaces show the current viewer\'s own snapshot (no impersonation)', async () => {
      perms.canEdit = true;
      render(<CourseLearn />);
      await screen.findAllByText(/Course completion is not shown while editing/);
      fireEvent.click(screen.getByRole('button', { name: /Preview as admin/ }));
      fireEvent.mouseDown(screen.getByRole('button', { name: /Preview as student/ }));
      expect(await screen.findByText(/6 lessons · Course completion 33%/)).toBeInTheDocument();
      expect(screen.getByText('2 / 3 complete')).toBeInTheDocument();
      expect(screen.getByText('0 / 3 complete')).toBeInTheDocument();
      expect(screen.queryByText('Draft Lesson')).not.toBeInTheDocument();
      // The hook is asked for the CURRENT viewer only: no student id override.
      for (const call of vi.mocked(useCourseProgress).mock.calls) expect(call.length === 1 || call[1] === undefined).toBe(true);
      expect(writeCalls()).toEqual([]);
    });
  });

  describe('end of course: certificate access follows an issued row, never the percent', () => {
    beforeEach(() => openItem('complete', 'summary'));

    it('100% stored progress with no issued certificate: no "View certificate", no award promise', async () => {
      setProgress({ done: ELIGIBLE });
      render(<CourseLearn />);
      expect(await screen.findByText('Check certificate status')).toBeInTheDocument();
      expect(screen.queryByText('View certificate')).not.toBeInTheDocument();
      expect(
        screen.getByText(
          'Every lesson is checked off. A certificate depends on the course’s own requirements and appears once it has been issued.',
        ),
      ).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/certificate (has been|is) (earned|awarded)|you('ve| have) earned/i);
      const certQuery = builders.find((x) => x.table === 'certificates')!.b;
      expect(certQuery.eq).toHaveBeenCalledWith('course_id', 'course-1');
      expect(certQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(writeCalls()).toEqual([]);
    });

    it('contradiction: an issued certificate with only 2 of 6 done stays reachable', async () => {
      mockTables({ courses: { data: courseRow, error: null }, certificates: { data: [{ id: 'cert-1' }], error: null } });
      render(<CourseLearn />);
      expect(await screen.findByText('View certificate')).toBeInTheDocument();
      expect(screen.getByText("You've completed 2 of 6 lessons.")).toBeInTheDocument();
      expect(screen.queryByText('Check certificate status')).not.toBeInTheDocument();
    });

    it('an unreadable certificate state shows neither certificate link', async () => {
      setProgress({ done: ELIGIBLE });
      mockTables({
        courses: { data: courseRow, error: null },
        certificates: { data: null, error: { message: 'permission denied' } },
      });
      render(<CourseLearn />);
      expect(await screen.findByText('Course complete')).toBeInTheDocument();
      await waitFor(() => expect(builders.some((x) => x.table === 'certificates')).toBe(true));
      expect(screen.queryByText('View certificate')).not.toBeInTheDocument();
      expect(screen.queryByText('Check certificate status')).not.toBeInTheDocument();
    });

    it('unknown progress never claims completion', async () => {
      setProgress({ error: 'progress fetch failed' });
      render(<CourseLearn />);
      expect(
        await screen.findByText('We couldn’t load your progress right now, so your completion status is unavailable.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Course complete')).not.toBeInTheDocument();
      expect(screen.queryByText('Check certificate status')).not.toBeInTheDocument();
    });
  });
});
