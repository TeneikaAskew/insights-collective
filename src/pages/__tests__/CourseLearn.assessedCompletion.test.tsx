// ABOUTME: Regression tests on the real /courses/:id/learn player: Next and "Mark as done" never complete
// ABOUTME: assignments or quizzes; only a submission does; failed saves are not shown as complete.
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, act } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import CanvasContentService from '@/services/canvasContentService';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import CourseLearn from '@/pages/CourseLearn';

const { mockParams, mockNavigate, mockMarkItemComplete, viewerProps } = vi.hoisted(() => ({
  mockParams: { courseId: 'course-1', moduleId: 'm1', itemId: 'a1' } as Record<string, string>,
  mockNavigate: vi.fn(),
  mockMarkItemComplete: vi.fn(),
  viewerProps: { current: null as any },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useParams: () => mockParams, useNavigate: () => mockNavigate };
});
vi.mock('@/hooks/useCourseProgress', () => ({ useCourseProgress: vi.fn() }));
vi.mock('@/services/canvasContentService', () => ({
  default: { getModules: vi.fn(), getContentItems: vi.fn() },
}));
vi.mock('@/hooks/useCoursePermissions', () => ({ useCoursePermissions: () => ({ canEdit: false }) }));
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({ user: { id: 'user-1' }, session: {}, loading: false, isAuthenticated: true, isAdmin: false }),
}));
vi.mock('@/components/onboarding/StudentLearnTour', () => ({ StudentLearnTour: () => null }));
// Capture the props CourseLearn passes to the viewer so we can drive its
// real handleMarkDone exactly as the viewer / submission forms do.
vi.mock('@/components/course/learn/LessonViewer', () => ({
  LessonViewer: (props: any) => {
    viewerProps.current = props;
    return null;
  },
}));
vi.mock('@/components/ui/hint', () => ({ Hint: (p: any) => p.children }));

function builder(result: any) {
  const b: any = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'upsert', 'update']) b[m] = vi.fn(() => b);
  b.single = vi.fn().mockResolvedValue({ data: result.data?.[0] ?? result.data, error: null });
  b.maybeSingle = b.single;
  b.then = (f: any, r: any) => Promise.resolve(result).then(f, r);
  return b;
}

window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('CourseLearn — assessed content completion', () => {
  beforeEach(() => {
    mockParams.itemId = 'a1';
    mockNavigate.mockReset();
    mockMarkItemComplete.mockReset().mockResolvedValue(undefined);
    viewerProps.current = null;
    vi.mocked(useCourseProgress).mockReturnValue({
      data: { modules: [], totalItems: 3, completedItems: 0, percent: 0 },
      isLoading: false, error: null, refetch: vi.fn(),
      markItemComplete: mockMarkItemComplete, getModulePercent: () => 0,
    } as any);
    vi.mocked(CanvasContentService.getModules).mockResolvedValue([{ id: 'm1', title: 'M', published: true }] as any);
    vi.mocked(CanvasContentService.getContentItems).mockResolvedValue([
      { id: 'a1', title: 'Essay', type: 'assignment', published: true },
      { id: 'q1', title: 'Checkpoint Quiz', type: 'quiz', published: true },
      { id: 'p1', title: 'Reading', type: 'page', published: true },
    ] as any);
    (mockSupabaseClient.from as Mock).mockImplementation((t: string) =>
      builder(t === 'courses' ? { data: { id: 'course-1', title: 'C' }, error: null } : { data: [], error: null }),
    );
  });

  it('Next on an unsubmitted assignment navigates without marking it complete', async () => {
    render(<CourseLearn />);
    expect(await screen.findByRole('heading', { name: 'Essay' })).toBeInTheDocument();
    expect(screen.queryAllByText('Complete and Continue')).toHaveLength(0);
    const [btn] = screen.getAllByRole('button', { name: /^Continue/ });
    await userEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/courses/course-1/learn/m1/q1');
    expect(mockMarkItemComplete).not.toHaveBeenCalled();
  });

  it('a view-level mark-done (scroll / button) on an assignment is refused', async () => {
    render(<CourseLearn />);
    await waitFor(() => expect(viewerProps.current?.item?.id).toBe('a1'));
    let r: any;
    await act(async () => { r = await viewerProps.current.onMarkDone('a1', 'view'); });
    expect(r).toBe(false);
    expect(mockMarkItemComplete).not.toHaveBeenCalled();
  });

  it('a quiz without a submitted attempt stays incomplete', async () => {
    mockParams.itemId = 'q1';
    render(<CourseLearn />);
    await waitFor(() => expect(viewerProps.current?.item?.id).toBe('q1'));
    await act(async () => { await viewerProps.current.onMarkDone('q1'); });
    expect(mockMarkItemComplete).not.toHaveBeenCalled();
    expect(viewerProps.current.isCompleted).toBe(false);
  });

  it('a successful submission marks the assignment complete', async () => {
    render(<CourseLearn />);
    await waitFor(() => expect(viewerProps.current?.item?.id).toBe('a1'));
    let r: any;
    await act(async () => { r = await viewerProps.current.onMarkDone('a1', 'submission'); });
    expect(r).toBe(true);
    expect(mockMarkItemComplete).toHaveBeenCalledWith('a1');
    await waitFor(() => expect(viewerProps.current.isCompleted).toBe(true));
  });

  it('a failed progress save after submission does not claim completion', async () => {
    mockMarkItemComplete.mockRejectedValue(new Error('permission denied'));
    render(<CourseLearn />);
    await waitFor(() => expect(viewerProps.current?.item?.id).toBe('a1'));
    let r: any;
    await act(async () => { r = await viewerProps.current.onMarkDone('a1', 'submission'); });
    expect(r).toBe(false);
    expect(viewerProps.current.isCompleted).toBe(false);
  });

  it('informational pages still complete on Next', async () => {
    mockParams.itemId = 'p1';
    render(<CourseLearn />);
    expect(await screen.findByRole('heading', { name: 'Reading' })).toBeInTheDocument();
    const [btn] = screen.getAllByRole('button', { name: /Complete and Continue/ });
    await userEvent.click(btn);
    await waitFor(() => expect(mockMarkItemComplete).toHaveBeenCalledWith('p1'));
  });
});
