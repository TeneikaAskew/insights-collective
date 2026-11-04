// ABOUTME: T-10 page integration with the REAL useCourseProgress against a filter-aware Supabase fake: a save is shown
// ABOUTME: only after readback, a reload shows the stored figure, and a refresh/failed read is unknown on every surface.
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, act } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import CanvasContentService from '@/services/canvasContentService';
import CourseLearn from '@/pages/CourseLearn';

const { mockParams, mockNavigate, perms } = vi.hoisted(() => ({
  mockParams: {} as { courseId?: string; moduleId?: string; itemId?: string },
  mockNavigate: vi.fn(),
  perms: { canEdit: false },
}));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useParams: () => mockParams, useNavigate: () => mockNavigate };
});
vi.mock('@/services/canvasContentService', () => ({
  default: { getModules: vi.fn(), getContentItems: vi.fn(), markContentItemAsRead: vi.fn() },
}));
vi.mock('@/hooks/useCoursePermissions', () => ({ useCoursePermissions: () => perms }));
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({ user: { id: 'user-1' }, session: {}, loading: false, error: null, isAuthenticated: true, isAdmin: false }),
}));
vi.mock('@/components/onboarding/StudentLearnTour', () => ({ StudentLearnTour: () => null }));
vi.mock('@/components/course/learn/LessonViewer', () => ({ LessonViewer: () => null }));
vi.mock('@/components/ui/hint', () => ({ Hint: (props: { children?: React.ReactNode }) => props.children }));
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const COURSE = '11111111-2222-4333-8444-555555555555';
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};
const tableErrors: Record<string, string | undefined> = {};
let progressGate: Promise<void> | null = null;

/** Filter-aware builder: eq/in are APPLIED to rows (strict equality, so published:null never matches true). */
function builder(table: string) {
  const filters: Array<[string, string, any]> = [];
  const run = () => {
    if (tableErrors[table]) return { data: null, error: { message: tableErrors[table] } };
    const rows = (tables[table] ?? []).filter((r) => filters.every(([op, c, v]) => (op === 'eq' ? r[c] === v : (v as any[]).includes(r[c]))));
    return { data: rows, error: null };
  };
  const b: any = {
    select: () => b, order: () => b, limit: () => b,
    eq: (c: string, v: any) => (filters.push(['eq', c, v]), b),
    in: (c: string, v: any[]) => (filters.push(['in', c, v]), b),
    single: async () => { const r = run(); return { data: r.data?.[0] ?? null, error: r.error }; },
    then: (ok: any, ko: any) => {
      const go = () => Promise.resolve(run()).then(ok, ko);
      return table === 'content_item_progressions' && progressGate ? progressGate.then(go) : go();
    },
  };
  return b;
}

function seed() {
  tables.courses = [{ id: COURSE, title: 'Real Hook Course', thumbnail: null, settings: {} }];
  tables.modules = [
    { id: 'm1', course_id: COURSE, published: true, title: 'Module One' },
    { id: 'm2', course_id: COURSE, published: true, title: 'Module Two' },
    { id: 'mDraft', course_id: COURSE, published: false, title: 'Draft Module' },
  ];
  tables.content_items = [
    { id: 'i1', module_id: 'm1', published: true, title: 'Lesson One', type: 'page' },
    { id: 'i2', module_id: 'm1', published: true, title: 'Lesson Two', type: 'page' },
    { id: 'i3', module_id: 'm1', published: true, title: 'Lesson Three', type: 'page' },
    { id: 'q4', module_id: 'm2', published: true, title: 'Quiz Four', type: 'quiz' },
    { id: 'i5', module_id: 'm2', published: true, title: 'Lesson Five', type: 'page' },
    { id: 'i6', module_id: 'm2', published: true, title: 'Lesson Six', type: 'page' },
    { id: 'iDraft', module_id: 'm1', published: false, title: 'Draft Lesson', type: 'page' },
    { id: 'x1', module_id: 'mDraft', published: true, title: 'In Draft Module', type: 'page' },
  ];
  tables.content_item_progressions = [
    { user_id: 'user-1', content_item_id: 'i1', workflow_state: 'read' },
    { user_id: 'user-1', content_item_id: 'i2', workflow_state: 'graded' },
    { user_id: 'user-1', content_item_id: 'x1', workflow_state: 'read' }, // ineligible: never counted
  ];
  tables.certificates = [];
}

const completion = () => screen.getByTestId('learn-completion');
function railCount(label: string) {
  return screen.getAllByText(label)[0].parentElement!.querySelector('div:last-child')!.textContent;
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  for (const k of Object.keys(tableErrors)) delete tableErrors[k];
  progressGate = null;
  perms.canEdit = false;
  mockParams.courseId = COURSE; mockParams.moduleId = 'm1'; mockParams.itemId = 'i3';
  mockNavigate.mockReset();
  seed();
  (mockSupabaseClient.from as Mock).mockImplementation((t: string) => builder(t));
  vi.mocked(CanvasContentService.getModules).mockImplementation(async () => tables.modules.map(({ id, title, published }) => ({ id, title, published })) as any);
  vi.mocked(CanvasContentService.getContentItems).mockImplementation(async (mid: string) => tables.content_items.filter((i) => i.module_id === mid) as any);
  vi.mocked(CanvasContentService.markContentItemAsRead).mockImplementation(async (id: string) => {
    tables.content_item_progressions.push({ user_id: 'user-1', content_item_id: id, workflow_state: 'read' });
  });
});

describe('CourseLearn with the real read model (T-10)', () => {
  it('stored 2/6 (33%), ineligible progress ignored; module figures from the same snapshot', async () => {
    render(<CourseLearn />);
    await waitFor(() => expect(completion()).toHaveTextContent('Course completion 33%'));
    expect(railCount('Section 1 · Module One')).toBe('2/3');
    expect(railCount('Section 2 · Module Two')).toBe('0/3');
  });

  it('a save is shown only after readback (3/6, 50%), and a remount reads the stored 50% back', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CourseLearn />);
    await waitFor(() => expect(completion()).toHaveTextContent('Course completion 33%'));
    progressGate = new Promise<void>(() => undefined); // hold the readback after the write
    await user.click(screen.getAllByRole('button', { name: /Complete and Continue/ })[0]);
    expect(CanvasContentService.markContentItemAsRead).toHaveBeenCalledWith('i3');
    // Written, but not yet read back: unknown, not an optimistic 50%.
    await waitFor(() => expect(completion()).toHaveTextContent('Course completion unavailable'));
    expect(railCount('Section 1 · Module One')).toBe('—');
    unmount();
    progressGate = null;
    render(<CourseLearn />); // reload
    await waitFor(() => expect(completion()).toHaveTextContent('Course completion 50%'));
    expect(railCount('Section 1 · Module One')).toBe('3/3');
  });

  it('a failed readback after a resolved write stays unknown with the error notice', async () => {
    const user = userEvent.setup();
    render(<CourseLearn />);
    await waitFor(() => expect(completion()).toHaveTextContent('Course completion 33%'));
    tableErrors.content_item_progressions = 'read failed';
    await act(async () => { await user.click(screen.getAllByRole('button', { name: /Complete and Continue/ })[0]); });
    await waitFor(() => expect(completion()).toHaveTextContent('Course completion unavailable'));
    expect(screen.getAllByText("Couldn't load your progress").length).toBeGreaterThan(0);
    expect(completion().textContent).not.toMatch(/\d+%/);
  });
});
