// ABOUTME: Gradebook integrity on the real /courses/:id/gradebook page: 0 shown as 0, CSV export matches
// ABOUTME: the table, failed export never claims success, and non-instructors never fetch grade rows.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import CourseGradebook from '../CourseGradebook';

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useParams: () => ({ courseId: 'course-1' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/useCoursePermissions', () => ({ useCoursePermissions: vi.fn() }));
const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock, dismiss: vi.fn(), toasts: [] }), toast: toastMock }));

function tb(data: unknown) {
  const b: any = {};
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'update']) b[m] = vi.fn(() => b);
  b.single = vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null });
  b.then = (f: any, r: any) => Promise.resolve({ data, error: null }).then(f, r);
  return b;
}
const tables: Record<string, unknown> = {
  enrollments: [{ user_id: 's1' }],
  profiles: [{ id: 's1', first_name: 'Ada', last_name: 'Lovelace' }],
  assignments: [{ id: 'a1', course_id: 'course-1', title: 'Essay, "one"', points: 100, is_published: true }],
  quizzes: [{ id: 'q1', title: 'Quiz 1', points_possible: 10, content_items: { course_id: 'course-1' } }],
  assignment_submissions: [{ id: 'sub', assignment_id: 'a1', user_id: 's1', grade: 0, workflow_state: 'graded', attempt: 1 }],
  quiz_submissions: [
    { id: 'qa1', quiz_id: 'q1', user_id: 's1', score: 9, attempt: 1, workflow_state: 'complete' },
    { id: 'qa2', quiz_id: 'q1', user_id: 's1', score: 6, attempt: 2, workflow_state: 'complete' },
  ],
};

function setPerm(canEdit: boolean) {
  vi.mocked(useCoursePermissions).mockReturnValue({ canEdit, isInstructor: canEdit, isAdmin: false, loading: false, error: null } as any);
}

let blobs: Blob[] = [];
beforeEach(() => {
  toastMock.mockClear();
  blobs = [];
  (mockSupabaseClient.from as Mock).mockClear();
  (mockSupabaseClient.from as Mock).mockImplementation((t: string) => tb(tables[t] ?? []));
  vi.mocked(useAuth).mockReturnValue(createMockAuthProvider({ user: { id: 'i1', email: 'i@x.org' }, isAuthenticated: true }) as any);
  (URL as any).createObjectURL = vi.fn((b: Blob) => { blobs.push(b); return 'blob:x'; });
  (URL as any).revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
});
afterEach(() => vi.useRealTimers());

const queried = () => (mockSupabaseClient.from as Mock).mock.calls.map((c) => c[0]);

describe('CourseGradebook integrity', () => {
  it('shows a graded 0 as 0 (not missing) and the latest quiz attempt', async () => {
    render(<CourseGradebook />);
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('/100').previousSibling).toHaveTextContent('0');
    expect(screen.getByText('/10').previousSibling).toHaveTextContent('6');
    expect(screen.getByText('6/110')).toBeInTheDocument();
  });

  it('exports a CSV built from the same numbers, and revokes the URL later, not immediately', async () => {
    render(<CourseGradebook />);
    await screen.findByText('Ada Lovelace');
    await userEvent.click(screen.getByRole('button', { name: /Export/ }));
    expect(blobs).toHaveLength(1);
    const text = await blobs[0].text();
    const lines = text.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toContain('"Essay, ""one"" (assignment) - earned"');
    expect(lines[1]).toBe('s1,Ada Lovelace,,0,100,graded,6,10,graded,6,110,5.45');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Gradebook CSV prepared' }));
  });

  it('a failed export shows an error, not a success toast', async () => {
    (URL as any).createObjectURL = vi.fn(() => { throw new Error('blocked'); });
    render(<CourseGradebook />);
    await screen.findByText('Ada Lovelace');
    await userEvent.click(screen.getByRole('button', { name: /Export/ }));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Export failed', variant: 'destructive' }));
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Gradebook CSV prepared' }));
  });

  it('a student (no edit rights) never requests submission or roster rows', async () => {
    setPerm(false);
    render(<CourseGradebook />);
    expect(screen.getByText(/You don't have permission to view the gradebook/)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(queried()).not.toContain('assignment_submissions');
    expect(queried()).not.toContain('quiz_submissions');
    expect(queried()).not.toContain('enrollments');
    expect(queried()).not.toContain('profiles');
    setPerm(true);
  });
});

beforeEach(() => setPerm(true));
