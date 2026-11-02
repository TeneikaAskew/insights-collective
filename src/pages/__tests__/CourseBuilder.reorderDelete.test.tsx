// ABOUTME: T-54 (UI half). Reorder must not leave an order the server refused, and a delete that
// ABOUTME: removed no row must not drop the item locally. Real CanvasContentService over a fake client.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CourseBuilder from '../CourseBuilder';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { TooltipProvider } from '@/components/ui/tooltip';

const toastSpy = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }), toast: toastSpy }));
vi.mock('@/hooks/useCoursePermissions', () => ({ useCoursePermissions: vi.fn() }));
vi.mock('@/contexts/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

// The curriculum view is replaced by a probe that shows the order the builder holds and drives its callbacks.
vi.mock('@/components/course/builder/teachable/CurriculumView', () => ({
  CurriculumView: ({ modules, onReorderModules, onReorderLessons, onDeleteModule, onDeleteLesson }: any) => (
    <div>
      <div data-testid="section-order">{modules.map((m: any) => m.id).join(',')}</div>
      {modules.map((m: any) => (
        <div key={m.id} data-testid={`section-${m.id}`}>
          <div data-testid={`lesson-order-${m.id}`}>{m.items.map((i: any) => i.id).join(',')}</div>
          <button type="button" onClick={() => onReorderLessons(m.id, [...m.items.map((i: any) => i.id)].reverse())}>
            reverse lessons {m.id}
          </button>
          <button type="button" onClick={() => onDeleteModule(m.id)}>delete section {m.id}</button>
          {m.items.map((i: any) => (
            <button key={i.id} type="button" onClick={() => onDeleteLesson(i.id)}>delete lesson {i.id}</button>
          ))}
        </div>
      ))}
      <button type="button" onClick={() => onReorderModules([...modules.map((m: any) => m.id)].reverse())}>
        reverse sections
      </button>
      <button type="button" onClick={() => onReorderModules(['m2', 'm1', 'm3'])}>swap first sections</button>
    </div>
  ),
}));
vi.mock('@/components/course/builder/teachable/TeachableShell', () => ({
  TeachableShell: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/course/builder/teachable/SetupGuideView', () => ({ SetupGuideView: () => null }));
vi.mock('@/components/course/builder/teachable/LessonEditView', () => ({ LessonEditView: () => null }));
vi.mock('@/components/course/builder/teachable/NewCourseWizard', () => ({ NewCourseWizard: () => null }));
vi.mock('@/components/onboarding/InstructorBuilderTour', () => ({ InstructorBuilderTour: () => null }));

// ---- in-memory tables ----
type Mod = { id: string; course_id: string; title: string; position: number };
type Item = { id: string; module_id: string; course_id: string; title: string; content: string; type: string; position: number; published: boolean; updated_at: string };
let mods: Map<string, Mod>;
let items: Map<string, Item>;
/** Ids RLS lets this user delete. Any other id: the delete matches nothing and returns success. */
let deletable: Set<string>;
let rpcBehaviour: (name: string, args: any) => Promise<{ data: null; error: any }>;
let failModuleRead = false;
let failItemRead = false;
const reads = { modules: 0, items: 0 };

const course = {
  id: 'course-1', title: 'Reorder course', description: '', thumbnail: null, image_url: null, published: false,
  category: 'Data', level: 'Beginner', tags: [], duration: null, estimated_hours: null, difficulty_level: null, settings: null,
};

function table(name: string) {
  const filters: Array<[string, any]> = [];
  let op: 'select' | 'delete' = 'select';
  let returning = false;
  const b: any = {};
  b.select = vi.fn(() => {
    if (op === 'delete') returning = true;
    return b;
  });
  b.delete = vi.fn(() => {
    op = 'delete';
    return b;
  });
  b.eq = vi.fn((col: string, v: any) => {
    filters.push([col, v]);
    return b;
  });
  for (const m of ['order', 'in', 'limit', 'update']) b[m] = vi.fn(() => b);
  const run = () => {
    if (name === 'courses') return { data: course, error: null };
    const store: Map<string, any> = name === 'modules' ? mods : items;
    const match = (r: any) => filters.every(([c, v]) => r[c] === v);
    if (op === 'delete') {
      const hit = [...store.values()].filter(match).filter((r) => deletable.has(r.id));
      hit.forEach((r) => store.delete(r.id));
      return { data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null };
    }
    if (name === 'modules') {
      reads.modules++;
      if (failModuleRead && reads.modules > 1) return { data: null, error: { message: 'read failed' } };
    } else {
      reads.items++;
      if (failItemRead && reads.items > 2) return { data: null, error: { message: 'read failed' } };
    }
    return { data: [...store.values()].filter(match).sort((a, z) => a.position - z.position), error: null };
  };
  b.single = vi.fn(() => Promise.resolve(run()));
  b.maybeSingle = b.single;
  b.then = (ok: any, bad: any) => Promise.resolve().then(run).then(ok, bad);
  return b;
}

function applyReorder(name: string, args: any) {
  if (name === 'reorder_modules') args.p_module_ids.forEach((id: string, i: number) => (mods.get(id)!.position = i));
  if (name === 'reorder_content_items') args.p_item_ids.forEach((id: string, i: number) => (items.get(id)!.position = i));
}

function seed() {
  mods = new Map(
    ['m1', 'm2', 'm3'].map((id, i) => [id, { id, course_id: 'course-1', title: `Section ${id}`, position: i }]),
  );
  items = new Map(
    ['a', 'b', 'c'].map((id, i) => [
      id,
      { id, module_id: 'm1', course_id: 'course-1', title: `Lesson ${id}`, content: '', type: 'page', position: i, published: false, updated_at: '2026-11-02T00:00:00Z' },
    ]),
  );
  deletable = new Set(['m1', 'm2', 'm3', 'a', 'b', 'c']);
  rpcBehaviour = async (name, args) => {
    applyReorder(name, args);
    return { data: null, error: null };
  };
}

function renderBuilder() {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/courses/course-1/builder?view=curriculum']}>
        <Routes>
          <Route path="/courses/:courseId/builder" element={<CourseBuilder />} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );
}

const sectionOrder = () => screen.getByTestId('section-order').textContent;
const lessonOrder = () => screen.getByTestId('lesson-order-m1').textContent;
const lastToast = () => toastSpy.mock.calls.at(-1)?.[0];

beforeEach(() => {
  toastSpy.mockClear();
  seed();
  failModuleRead = false;
  failItemRead = false;
  reads.modules = 0;
  reads.items = 0;
  vi.mocked(useCoursePermissions).mockReturnValue({ canEdit: true, isInstructor: true, isAdmin: false, loading: false, error: null } as any);
  (mockSupabaseClient.from as any).mockImplementation((t: string) => table(t));
  (mockSupabaseClient.rpc as any).mockImplementation((name: string, args: any) => rpcBehaviour(name, args));
});

async function loaded() {
  renderBuilder();
  await waitFor(() => expect(sectionOrder()).toBe('m1,m2,m3'));
  expect(lessonOrder()).toBe('a,b,c');
}

describe('T-54 reorder: a refused reorder does not stay on screen', () => {
  it('R1 section reorder RPC fails: the order the server holds is shown again', async () => {
    await loaded();
    rpcBehaviour = async () => ({ data: null, error: { message: 'permission denied for function reorder_modules' } });
    fireEvent.click(screen.getByText('reverse sections'));
    await waitFor(() => expect(lastToast()?.title).toBe('Sections not reordered'));
    expect(sectionOrder()).toBe('m1,m2,m3');
    expect([...mods.values()].sort((a, z) => a.position - z.position).map((m) => m.id).join(',')).toBe('m1,m2,m3');
    expect(lastToast().description).toContain('The saved order was reloaded.');
  });

  it('R2 lesson reorder RPC fails: the saved lesson order is shown again', async () => {
    await loaded();
    rpcBehaviour = async () => ({ data: null, error: { message: 'network down' } });
    fireEvent.click(screen.getByText('reverse lessons m1'));
    await waitFor(() => expect(lastToast()?.title).toBe('Lessons not reordered'));
    expect(lessonOrder()).toBe('a,b,c');
  });

  it('R3 reorder fails and the reload fails too: the previous local order is restored', async () => {
    await loaded();
    failModuleRead = true;
    rpcBehaviour = async () => ({ data: null, error: { message: 'timeout' } });
    fireEvent.click(screen.getByText('reverse sections'));
    await waitFor(() => expect(lastToast()?.title).toBe('Sections not reordered'));
    expect(sectionOrder()).toBe('m1,m2,m3');
    expect(lastToast().description).toContain('The previous order was restored');
  });

  it('R4 the server changed order elsewhere: a failed reorder shows the server order, not the stale local one', async () => {
    await loaded();
    // Another tab moved m3 first; this tab still shows m1,m2,m3.
    mods.get('m3')!.position = -1;
    rpcBehaviour = async () => ({ data: null, error: { message: 'conflict' } });
    fireEvent.click(screen.getByText('swap first sections'));
    await waitFor(() => expect(lastToast()?.title).toBe('Sections not reordered'));
    expect(sectionOrder()).toBe('m3,m1,m2');
  });

  it('R5 guard: an older reorder that fails after a newer one succeeded does not undo the newer order', async () => {
    await loaded();
    let rejectFirst!: (e: any) => void;
    let call = 0;
    rpcBehaviour = (name, args) => {
      call++;
      if (call === 1) return new Promise((res) => (rejectFirst = () => res({ data: null, error: { message: 'late failure' } })));
      applyReorder(name, args);
      return Promise.resolve({ data: null, error: null });
    };
    fireEvent.click(screen.getByText('swap first sections'));
    await waitFor(() => expect(sectionOrder()).toBe('m2,m1,m3'));
    fireEvent.click(screen.getByText('reverse sections'));
    await waitFor(() => expect(sectionOrder()).toBe('m3,m1,m2'));
    await waitFor(() => expect(call).toBe(2));
    rejectFirst(undefined);
    await waitFor(() => expect(lastToast()?.title).toBe('Sections not reordered'));
    expect(sectionOrder()).toBe('m3,m1,m2');
  });

  it('R6 control: a successful reorder keeps the new order and reloads nothing', async () => {
    await loaded();
    const before = reads.modules;
    fireEvent.click(screen.getByText('reverse sections'));
    await waitFor(() => expect(mods.get('m3')!.position).toBe(0));
    expect(sectionOrder()).toBe('m3,m2,m1');
    expect(reads.modules).toBe(before);
    expect(toastSpy).not.toHaveBeenCalled();
  });
});

describe('T-54 delete: a delete that removed no row keeps the item', () => {
  it('D1 lesson delete matches no row (RLS-hidden): the lesson stays and the author is told', async () => {
    await loaded();
    deletable.delete('b');
    fireEvent.click(screen.getByText('delete lesson b'));
    await waitFor(() => expect(lastToast()?.title).toBe('Lesson not deleted'));
    expect(lessonOrder()).toBe('a,b,c');
    expect(items.has('b')).toBe(true);
  });

  it('D2 section delete matches no row: the section and its lessons stay', async () => {
    await loaded();
    deletable.delete('m1');
    fireEvent.click(screen.getByText('delete section m1'));
    await waitFor(() => expect(lastToast()?.title).toBe('Section not deleted'));
    expect(sectionOrder()).toBe('m1,m2,m3');
    expect(within(screen.getByTestId('section-m1')).getByTestId('lesson-order-m1').textContent).toBe('a,b,c');
  });

  it('D3 control: an applied delete removes the lesson and the section', async () => {
    await loaded();
    fireEvent.click(screen.getByText('delete lesson b'));
    await waitFor(() => expect(lessonOrder()).toBe('a,c'));
    fireEvent.click(screen.getByText('delete section m2'));
    await waitFor(() => expect(sectionOrder()).toBe('m1,m3'));
    expect(toastSpy).not.toHaveBeenCalled();
  });
});
