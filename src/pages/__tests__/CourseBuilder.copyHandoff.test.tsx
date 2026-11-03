// ABOUTME: T-18. The builder page creates a copied course only for the account that adopted the copy, from a
// ABOUTME: source it still owns; a mismatch is refused before any upload or insert. Real CourseBuilder handler.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CourseBuilder from '../CourseBuilder';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createFakeDb, type FakeDb } from '@/components/course/builder/__tests__/fakeCreationDb';

const toastSpy = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }), toast: toastSpy }));
vi.mock('@/hooks/useCoursePermissions', () => ({ useCoursePermissions: vi.fn() }));
vi.mock('@/contexts/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuth: () => ({ user: { id: 'u1' } }),
}));

// The wizard is replaced by a probe that submits `probe.result`, as the real wizard does after its own checks.
const probe = vi.hoisted(() => ({ result: null as any }));
vi.mock('@/components/course/builder/teachable/NewCourseWizard', async () => {
  const { useState } = await import('react');
  return {
    NewCourseWizard: ({ onFinish }: any) => {
      const [msg, setMsg] = useState('');
      return (
        <div>
          <button type="button" onClick={() => onFinish(probe.result, () => undefined).then(() => setMsg('ok'), (e: any) => setMsg(e.message))}>
            create course
          </button>
          <div data-testid="wizard-result">{msg}</div>
        </div>
      );
    },
  };
});
vi.mock('@/components/course/builder/teachable/TeachableShell', () => ({ TeachableShell: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/course/builder/teachable/SetupGuideView', () => ({ SetupGuideView: () => null }));
vi.mock('@/components/onboarding/InstructorBuilderTour', () => ({ InstructorBuilderTour: () => null }));

let db: FakeDb;
let ctlReads: string[] = [];
let ownershipGate: { arrived: boolean; promise: Promise<void>; release: () => void } | null;
const signedInAs = (id: string | null) =>
  (mockSupabaseClient.auth.getUser as any).mockResolvedValue({ data: { user: id ? { id } : null }, error: null });
const writes = () => ({
  courses: db.tables.courses.size,
  modules: db.tables.modules.size,
  content_items: db.tables.content_items.size,
  uploads: db.uploads.length,
});
let before: ReturnType<typeof writes>;

const OUTLINE = [{ title: 'First', lessons: [{ title: 'One', type: 'page' as const, content: '<p>Hello</p>' }] }];
const copyResult = (over: Record<string, any> = {}) => ({
  title: 'Copied course',
  description: '',
  outlineMethod: 'copy' as const,
  thumbnailFile: new File(['x'], 'thumb.png', { type: 'image/png' }),
  outline: OUTLINE,
  copySource: { courseId: 'src-1', actorId: 'u1' },
  ...over,
});

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

beforeEach(() => {
  toastSpy.mockClear();
  db = createFakeDb();
  ownershipGate = null;
  ctlReads = [];
  db.tables.courses.set('src-1', { id: 'src-1', title: 'Source', instructor_id: 'u1' });
  vi.mocked(useCoursePermissions).mockReturnValue({ canEdit: true, isInstructor: true, isAdmin: false, loading: false, error: null } as any);
  (mockSupabaseClient.from as any).mockImplementation((t: string) => {
    const b = db.client.from(t);
    const ms = b.maybeSingle;
    b.maybeSingle = async () => {
      ctlReads.push(`${t}:one`);
      if (t === 'courses' && ownershipGate) {
        ownershipGate.arrived = true;
        await ownershipGate.promise;
      }
      return ms();
    };
    return b;
  });
  (mockSupabaseClient.storage.from as any).mockImplementation((b: string) => db.client.storage.from(b));
  signedInAs('u1');
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/courses/new/builder']}>
        <Routes>
          <Route path="/courses/new/builder" element={<CourseBuilder />} />
          <Route path="/courses/:courseId/builder" element={<div data-testid="builder-open" />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </TooltipProvider>,
  );
  before = writes();
});

const attempt = async (expected: string | RegExp) => {
  fireEvent.click(screen.getByText('create course'));
  await waitFor(() => expect(screen.getByTestId('wizard-result').textContent).toMatch(expected));
};

describe('T-18 copy handoff: the builder page re-checks the copy before any upload or insert', () => {
  it('H1 positive: the adopting account, still owning the source, gets one course with the copied text', async () => {
    probe.result = copyResult();
    fireEvent.click(screen.getByText('create course'));
    await screen.findByTestId('builder-open');
    expect(db.tables.courses.size).toBe(2); // exactly one new course
    const dest = [...db.tables.courses.values()].find((c) => c.id !== 'src-1');
    expect(screen.getByTestId('location').textContent).toBe(`/courses/${dest.id}/builder`);
    expect(screen.getByTestId('location').textContent).not.toBe('/courses/new/builder');
    expect(dest.instructor_id).toBe('u1');
    expect([...db.tables.content_items.values()].map((i) => i.content)).toEqual(['<p>Hello</p>']);
  });

  it('H2 a different account signed in at the page is refused: no upload, no insert', async () => {
    probe.result = copyResult();
    signedInAs('u2');
    await attempt(/different account/);
    expect(writes()).toEqual(before);
  });

  it('H3 a copy result without its source is refused: no upload, no insert', async () => {
    probe.result = copyResult({ copySource: undefined });
    await attempt(/different account/);
    expect(writes()).toEqual(before);
  });

  it('H4 a source no longer owned by the account is refused: no upload, no insert', async () => {
    probe.result = copyResult();
    db.tables.courses.get('src-1').instructor_id = 'u3';
    await attempt(/not one of your courses/);
    expect(writes()).toEqual(before);
  });

  it('H5 an account switch between the wizard checks and the page (during its ownership read) is refused: no upload, no insert', async () => {
    probe.result = copyResult();
    let release!: () => void;
    ownershipGate = { arrived: false, promise: new Promise<void>((r) => (release = r)), release: () => release() };
    fireEvent.click(screen.getByText('create course'));
    await waitFor(() => expect(ownershipGate!.arrived).toBe(true));
    signedInAs('u2');
    ownershipGate.release();
    await waitFor(() => expect(screen.getByTestId('wizard-result').textContent).toMatch(/different account/));
    expect(writes()).toEqual(before);
  });

  it('H6 a credential-bearing outline reaching the page is refused: no upload, no insert', async () => {
    const bad = ['<a href="/a.pdf?access', '_token=abc">x</a>'].join('');
    probe.result = copyResult({ outline: [{ title: 'S', lessons: [{ title: 'L', type: 'page', content: bad }] }] });
    await attempt(/sign-in key/);
    expect(writes()).toEqual(before);
  });

  it('H7 signed out at the page is refused: no upload, no insert', async () => {
    probe.result = copyResult();
    signedInAs(null);
    await attempt(/different account/);
    expect(writes()).toEqual(before);
  });

  it('H8 T-56 kept: a copied course whose lesson insert failed is finished by the retry, not created twice', async () => {
    probe.result = copyResult({ thumbnailFile: null });
    db.faults.set('content_items#1', 'fail');
    await attempt('content_items insert failed');
    expect(db.tables.courses.size).toBe(2);
    const firstId = [...db.tables.courses.keys()].find((id) => id !== 'src-1');
    expect(screen.getByTestId('location').textContent).toBe('/courses/new/builder');
    expect(db.tables.content_items.size).toBe(0);
    fireEvent.click(screen.getByText('create course'));
    await screen.findByTestId('builder-open');
    expect(screen.getByTestId('location').textContent).toBe(`/courses/${firstId}/builder`);
    expect(db.tables.courses.size).toBe(2);
    expect([...db.tables.content_items.values()].map((i) => [i.course_id, i.title, i.content])).toEqual([[firstId, 'One', '<p>Hello</p>']]);
  });

  it.each(['scratch', 'ai'] as const)('H9 a %s result (no copySource) is not affected by the copy check and opens its new course', async (method) => {
    probe.result = copyResult({ outlineMethod: method, copySource: undefined, thumbnailFile: null });
    fireEvent.click(screen.getByText('create course'));
    await screen.findByTestId('builder-open');
    expect(db.tables.courses.size).toBe(2);
    const dest = [...db.tables.courses.values()].find((c) => c.id !== 'src-1');
    expect(screen.getByTestId('location').textContent).toBe(`/courses/${dest.id}/builder`);
    expect(ctlReads.filter((r) => r === 'courses:one')).toEqual([]); // the copy ownership check did not run
  });
});
