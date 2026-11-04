// ABOUTME: Exact DOM truthfulness of the outer Continue button: for quizzes and assignments its label, hint and
// ABOUTME: accessible name never claim completion (it only navigates); pages keep their completing wording.
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
// Render the hint text as an attribute so the exact tooltip wording is asserted, not mocked away.
vi.mock('@/components/ui/hint', () => ({
  Hint: (p: any) => <div data-testid="hint" data-hint-label={p.label}>{p.children}</div>,
}));

function builder(result: any) {
  const b: any = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'upsert', 'update']) b[m] = vi.fn(() => b);
  b.single = vi.fn().mockResolvedValue({ data: result.data?.[0] ?? result.data, error: null });
  b.maybeSingle = b.single;
  b.then = (f: any, r: any) => Promise.resolve(result).then(f, r);
  return b;
}

window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('CourseLearn: assessment navigation label truthfulness', () => {
  beforeEach(() => {
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
      { id: 'p2', title: 'Wrap-up', type: 'page', published: true },
    ] as any);
    (mockSupabaseClient.from as Mock).mockImplementation((t: string) =>
      builder(t === 'courses' ? { data: { id: 'course-1', title: 'C' }, error: null } : { data: [], error: null }),
    );
  });

  async function outerButton(heading: string) {
    render(<CourseLearn />);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    const btn = document.querySelector('[data-onboarding="learn-continue"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    const hint = btn.closest('[data-testid="hint"]') as HTMLElement;
    expect(hint).not.toBeNull();
    return { btn, hint };
  }

  for (const [itemId, heading, next] of [
    ['a1', 'Essay', 'q1'],
    ['q1', 'Checkpoint Quiz', 'p1'],
  ] as const) {
    it(`${itemId}: label, hint and accessible name never claim completion; click only navigates`, async () => {
      mockParams.itemId = itemId;
      const { btn, hint } = await outerButton(heading);

      // Both breakpoint spans are in the DOM (CSS hides one), so assert each exactly.
      const spans = Array.from(btn.querySelectorAll('span')).map((s) => [s.className, s.textContent]);
      expect(spans).toEqual([
        ['hidden sm:inline', 'Continue'],
        ['sm:hidden', 'Next'],
      ]);
      expect(btn.textContent).not.toMatch(/complete|done/i);
      expect(hint.getAttribute('data-hint-label')).toBe('Go to the next lesson. This does not submit or complete this one.');
      expect(btn.getAttribute('aria-label')).toBe('Continue to the next lesson without completing this one');
      expect(screen.getByRole('button', { name: 'Continue to the next lesson without completing this one' })).toBe(btn);

      await userEvent.click(btn);
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(`/courses/course-1/learn/m1/${next}`));
      expect(mockMarkItemComplete).not.toHaveBeenCalled();
    });
  }

  it('page: completing wording and behavior are unchanged', async () => {
    mockParams.itemId = 'p1';
    const { btn, hint } = await outerButton('Reading');
    const spans = Array.from(btn.querySelectorAll('span')).map((s) => [s.className, s.textContent]);
    expect(spans).toEqual([
      ['hidden sm:inline', 'Complete and Continue'],
      ['sm:hidden', 'Complete'],
    ]);
    expect(hint.getAttribute('data-hint-label')).toBe('Mark this lesson done and continue');
    expect(btn.hasAttribute('aria-label')).toBe(false);

    await userEvent.click(btn);
    await waitFor(() => expect(mockMarkItemComplete).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/courses/course-1/learn/m1/p2'));
  });
});
