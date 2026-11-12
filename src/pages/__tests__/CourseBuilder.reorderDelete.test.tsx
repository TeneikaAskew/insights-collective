// ABOUTME: T-54 (UI half). Reorder must not leave an order the server refused, and a delete that
// ABOUTME: removed no row must not drop the item locally. Real CanvasContentService over a fake client.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
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
          <button type="button" onClick={() => onReorderLessons(m.id, ['b', 'a', 'c'])}>swap first lessons {m.id}</button>
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
  b.is = b.eq;
  for (const m of ['order', 'in', 'limit', 'update']) b[m] = vi.fn(() => b);
  const run = () => {
    if (name === 'courses') {
      const id = filters.find(([c]) => c === 'id')?.[1] ?? course.id;
      return { data: { ...course, id }, error: null };
    }
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

function GoToCourse2() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/courses/course-2/builder?view=curriculum')}>
      open course 2
    </button>
  );
}

function renderBuilder() {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/courses/course-1/builder?view=curriculum']}>
        <Routes>
          <Route path="/courses/:courseId/builder" element={<CourseBuilder />} />
        </Routes>
        <GoToCourse2 />
      </MemoryRouter>
    </TooltipProvider>,
  );
}


// ---- overlapping reorders: every RPC is held until the test settles it ----
type Pending = { key: string; settle: (ok: boolean) => void };
let pending: Pending[] = [];
let rpcCalls: Array<[string, any]> = [];
function deferRpc() {
  pending = [];
  rpcCalls = [];
  rpcBehaviour = (name, args) =>
    new Promise((res) => {
      rpcCalls.push([name, args]);
      const key = (args.p_module_ids ?? args.p_item_ids).join(',');
      pending.push({
        key,
        settle: (ok) => {
          if (ok) applyReorder(name, args);
          res(ok ? { data: null, error: null } : { data: null, error: { message: `refused ${key}` } });
        },
      });
    });
}
/** Settle each listed order once it has been sent, preferring earlier entries of `priority` when several wait. */
async function drive(outcomes: Record<string, 'ok' | 'fail'>, priority: string[]) {
  const left = new Set(Object.keys(outcomes));
  while (left.size) {
    await waitFor(() => expect(pending.length).toBeGreaterThan(0));
    const p = priority.map((k) => pending.find((x) => x.key === k)).find(Boolean)!;
    pending.splice(pending.indexOf(p), 1);
    left.delete(p.key);
    p.settle(outcomes[p.key] === 'ok');
  }
}
const serverSections = () => [...mods.values()].sort((a, z) => a.position - z.position).map((m) => m.id).join(',');
const serverLessons = () =>
  [...items.values()].filter((i) => i.module_id === 'm1').sort((a, z) => a.position - z.position).map((i) => i.id).join(',');

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
    expect(lastToast().description).toMatch(/order was restored/);
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

  it('R5 an older reorder that fails while a newer one is waiting does not undo the newer, saved order', async () => {
    await loaded();
    deferRpc();
    fireEvent.click(screen.getByText('swap first sections'));
    fireEvent.click(screen.getByText('reverse sections'));
    await drive({ 'm2,m1,m3': 'fail', 'm3,m1,m2': 'ok' }, ['m3,m1,m2', 'm2,m1,m3']);
    await waitFor(() => expect(serverSections()).toBe('m3,m1,m2'));
    await waitFor(() => expect(sectionOrder()).toBe('m3,m1,m2'));
    expect(toastSpy.mock.calls.map((c) => c[0].title)).not.toContain('Sections not reordered');
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


type Scope = { name: string; first: string; second: string; a: string; b: string; shown: () => string | null; server: () => string; base: string; toast: string; failRead: () => void };
const SCOPES: Scope[] = [
  { name: 'sections', first: 'swap first sections', second: 'reverse sections', a: 'm2,m1,m3', b: 'm3,m1,m2', shown: () => sectionOrder(), server: () => serverSections(), base: 'm1,m2,m3', toast: 'Sections not reordered', failRead: () => (failModuleRead = true) },
  { name: 'lessons', first: 'swap first lessons m1', second: 'reverse lessons m1', a: 'b,a,c', b: 'c,a,b', shown: () => lessonOrder(), server: () => serverLessons(), base: 'a,b,c', toast: 'Lessons not reordered', failRead: () => (failItemRead = true) },
];

describe.each(SCOPES)('T-54 overlapping $name reorders end on the stored order', (sc) => {
  it('O1 both requests fail and the reload fails too: the last stored order is shown, not a speculative one', async () => {
    await loaded();
    deferRpc();
    sc.failRead();
    fireEvent.click(screen.getByText(sc.first));
    fireEvent.click(screen.getByText(sc.second));
    await drive({ [sc.a]: 'fail', [sc.b]: 'fail' }, [sc.b, sc.a]);
    await waitFor(() => expect(lastToast()?.title).toBe(sc.toast));
    await waitFor(() => expect(sc.shown()).toBe(sc.base));
    expect(sc.server()).toBe(sc.base);
  });

  it('O2 the older request succeeds after the newer one failed: the shown order is the stored (older) one', async () => {
    await loaded();
    deferRpc();
    fireEvent.click(screen.getByText(sc.first));
    fireEvent.click(screen.getByText(sc.second));
    await drive({ [sc.a]: 'ok', [sc.b]: 'fail' }, [sc.b, sc.a]);
    await waitFor(() => expect(sc.server()).toBe(sc.a));
    await waitFor(() => expect(lastToast()?.title).toBe(sc.toast));
    await waitFor(() => expect(sc.shown()).toBe(sc.a));
  });

  it('O3 guard: both requests fail with the reload working: the stored order is shown', async () => {
    await loaded();
    deferRpc();
    fireEvent.click(screen.getByText(sc.first));
    fireEvent.click(screen.getByText(sc.second));
    await drive({ [sc.a]: 'fail', [sc.b]: 'fail' }, [sc.b, sc.a]);
    await waitFor(() => expect(lastToast()?.title).toBe(sc.toast));
    await waitFor(() => expect(sc.shown()).toBe(sc.base));
  });

  it('O4 newer success: the older request fails while the newer waits; the newer order is saved and shown', async () => {
    await loaded();
    deferRpc();
    fireEvent.click(screen.getByText(sc.first));
    fireEvent.click(screen.getByText(sc.second));
    await drive({ [sc.a]: 'fail', [sc.b]: 'ok' }, [sc.b, sc.a]);
    await waitFor(() => expect(sc.server()).toBe(sc.b));
    await waitFor(() => expect(sc.shown()).toBe(sc.b));
  });
});


describe('T-54 reorder targets stay bound to their own course', () => {
  it('B1 switching course A to course B while A is pending: each reorder goes to its own course', async () => {
    mods.set('m4', { id: 'm4', course_id: 'course-2', title: 'Section m4', position: 0 });
    mods.set('m5', { id: 'm5', course_id: 'course-2', title: 'Section m5', position: 1 });
    await loaded();
    deferRpc();
    fireEvent.click(screen.getByText('swap first sections'));
    await waitFor(() => expect(rpcCalls).toHaveLength(1));
    fireEvent.click(screen.getByText('open course 2'));
    await waitFor(() => expect(sectionOrder()).toBe('m4,m5'));
    fireEvent.click(screen.getByText('reverse sections'));
    await drive({ 'm2,m1,m3': 'ok', 'm5,m4': 'ok' }, ['m2,m1,m3', 'm5,m4']);
    await waitFor(() => expect(rpcCalls).toHaveLength(2));
    expect(rpcCalls.map(([n, a]) => [n, a.p_course_id, a.p_module_ids.join(',')])).toEqual([
      ['reorder_modules', 'course-1', 'm2,m1,m3'],
      ['reorder_modules', 'course-2', 'm5,m4'],
    ]);
    await waitFor(() => expect(sectionOrder()).toBe('m5,m4'));
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

describe('reconciled unassigned group and reorder controls', () => {
  const group = 'unassigned:course-1';
  async function withUnassigned() {
    items.set('loose', { ...items.get('a')!, id: 'loose', module_id: null, title: 'Loose', position: 9 });
    renderBuilder();
    await waitFor(() => expect(sectionOrder()).toBe(`m1,m2,m3,${group}`));
  }
  it.each([false, true])('excludes the synthetic group and retains it after failed reorder (reload fails: %s)', async failedReload => {
    await withUnassigned();
    const before = { ...items.get('loose')! };
    const sends: string[][] = [];
    failModuleRead = failedReload;
    rpcBehaviour = async (_name,args) => { sends.push(args.p_module_ids); return {data:null,error:{message:'synthetic failure'}}; };
    fireEvent.click(screen.getByText('reverse sections'));
    await waitFor(() => expect(lastToast()?.title).toBe('Sections not reordered'));
    expect(sends).toEqual([['m3','m2','m1']]);
    expect(sectionOrder()).toBe(`m1,m2,m3,${group}`);
    expect(items.get('loose')).toEqual(before);
  });
  it('keeps the synthetic group after queued failure/success and never sends its id', async () => {
    await withUnassigned(); deferRpc();
    fireEvent.click(screen.getByText('swap first sections'));
    fireEvent.click(screen.getByText('reverse sections'));
    expect(pending.map(p=>p.key)).toEqual(['m2,m1,m3']);
    await drive({'m2,m1,m3':'fail','m3,m1,m2':'ok'},['m2,m1,m3','m3,m1,m2']);
    await waitFor(() => expect(sectionOrder()).toBe(`m3,m1,m2,${group}`));
    expect(serverSections()).toBe('m3,m1,m2');
    expect(items.get('loose')?.module_id).toBeNull();
  });
  it('blocks synthetic lesson reorder before transport and preserves zero-row delete handling', async () => {
    await withUnassigned();
    const rpc = vi.fn(async()=>({data:null,error:null})); rpcBehaviour=rpc;
    fireEvent.click(screen.getByText(`reverse lessons ${group}`));
    expect(rpc).not.toHaveBeenCalled(); expect(lastToast()?.title).toBe('Saved order kept');
    fireEvent.click(screen.getByText('delete lesson loose'));
    await waitFor(() => expect(lastToast()?.title).toBe('Lesson not deleted'));
    expect(items.has('loose')).toBe(true);
    expect(screen.getByTestId(`lesson-order-${group}`).textContent).toBe('loose');
  });
});
