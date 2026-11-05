// ABOUTME: Lesson save/reload persistence through the real builder, lesson view and editor pane.
// ABOUTME: Backed by an in-memory content_items fake so the same file runs on old and new source.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CourseBuilder from '../CourseBuilder';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import CanvasContentService from '@/services/canvasContentService';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { TooltipProvider } from '@/components/ui/tooltip';

const toastSpy = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
  toast: toastSpy,
}));
vi.mock('@/hooks/useCoursePermissions', () => ({ useCoursePermissions: vi.fn() }));
// The signed-in user. Old source ignores it; the fix scopes drafts to it.
let authUserId: string | null = 'user-1';
vi.mock('@/contexts/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuth: () => ({ user: authUserId ? { id: authUserId } : null }),
}));

// Simulates a full page reload: the fix keeps one queue per (user, course) for the tab's lifetime.
// Absent on old source, where every mount already builds a fresh queue.
const queueModules = import.meta.glob('/src/components/course/builder/lessonSaveQueue.ts', { eager: true }) as Record<
  string,
  any
>;
const simulatePageReload = () => {
  Object.values(queueModules).forEach((m) => m.__resetSharedLessonSaveQueues?.());
};

// The rich editor is TipTap; replace it with a textarea that has the same
// controlled contract (content in, onChange out).
vi.mock('@/components/ui/unified-canvas-editor', () => ({
  UnifiedCanvasEditor: ({ content, onChange }: any) => (
    <textarea aria-label="Lesson body" value={content} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('@/components/course/builder/QuizContentEditor', () => ({ QuizContentEditor: () => null }));
vi.mock('@/components/course/builder/AiContentDialog', () => ({ AiContentDialog: () => null }));
vi.mock('@/components/onboarding/InstructorBuilderTour', () => ({ InstructorBuilderTour: () => null }));
// Minimal shell: a real <a href> Preview link and the children. The real shell
// is covered elsewhere; this keeps the test about persistence.
vi.mock('@/components/course/builder/teachable/TeachableShell', async () => {
  const { Link } = await import('react-router-dom');
  return {
    TeachableShell: ({ previewHref, onNavigate, children }: any) => (
      <div>
        <Link to={previewHref}>Preview</Link>
        <button type="button" onClick={() => onNavigate('curriculum')}>
          Go to curriculum
        </button>
        {children}
      </div>
    ),
  };
});

// ---- in-memory content_items ----
type Row = {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  content: string;
  type: string;
  published: boolean;
  position: number;
  updated_at: string | null;
};
let db: Map<string, Row>;
let tick = 0;
const stamp = () => `2026-11-01T10:00:${String(++tick).padStart(2, '0')}.000000+00:00`;

type Kind = 'draft' | 'side';
type Gate = (op: { id: string; fields: any; kind: Kind }) => Promise<void> | void;
let gate: Gate;
/** When true for a write, the write is APPLIED and then its response is lost (network drop). */
let loseResponse: (op: { id: string; kind: Kind }) => boolean | Error;
/**
 * When true for a draft write, the request fails NOW with a transport error, but the server still holds it
 * and commits it later, when `releaseLate()` runs. Its condition is evaluated at commit time, like a real
 * conditional UPDATE.
 */
let delayApply: (op: { id: string; fields: any }) => boolean;
const lateApplies: Array<() => void> = [];
const releaseLate = () => lateApplies.splice(0).forEach((f) => f());
let inFlight = 0;
let maxInFlight = 0;
const writes: Array<{ id: string; kind: Kind; title?: string; content?: string; published?: boolean }> = [];
/** Every attempt to write a non-draft change (rename/publish side path), whatever its outcome. */
const sideAttempts: Array<{ id: string; fields: any }> = [];
/** Every write attempt of any kind, recorded before the gate decides its fate. */
const attempts: Array<{ id: string; kind: Kind; fields: any; as: string | null }> = [];

/** A definitive PostgREST-style rejection: carries a code, so the write certainly did not apply. */
const rejected = (message: string) => Object.assign(new Error(message), { code: '42501' });

/**
 * Document loss. While `docDead` is set (the old page is being torn down by a crash), requests never leave.
 * A request sent by an earlier document (`epoch` moved on) still reaches the server and commits if its
 * condition holds, but its response is never delivered: nobody is left to receive it.
 */
let docDead = false;
let epoch = 0;
const never = <T,>() => new Promise<T>(() => undefined);

async function gated<T>(id: string, fields: any, kind: Kind, apply: () => T): Promise<T> {
  if (docDead) return never<T>();
  const ep = epoch;
  attempts.push({ id, kind, fields, as: authUserId });
  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);
  try {
    await gate({ id, fields, kind });
    const out = apply();
    const lost = loseResponse({ id, kind });
    if (lost) throw lost === true ? new TypeError('Failed to fetch') : lost;
    if (ep !== epoch) return never<T>();
    return out;
  } catch (e) {
    if (ep !== epoch) return never<T>();
    throw e;
  } finally {
    inFlight -= 1;
  }
}

/** Optimistic check as the service on each source performs it. */
function versionMismatch(row: Row, expected: string | null | undefined, nullSafe: boolean) {
  if (nullSafe) return row.updated_at !== expected; // fix: null means "IS NULL", undefined is refused upstream
  return !!expected && row.updated_at !== expected; // old: a null base meant "no condition"
}
function conflict(row: Row) {
  const err: any = new Error('changed elsewhere');
  err.name = 'LessonSaveConflictError';
  err.current = { id: row.id, title: row.title, content: row.content, type: row.type, published: row.published, updated_at: row.updated_at };
  return err;
}

function seed() {
  db = new Map();
  const base = { course_id: 'course-1', module_id: 'm1', type: 'page', published: true };
  db.set('A', { ...base, id: 'A', title: 'Lesson A', content: 'Body A', position: 0, updated_at: stamp() });
  db.set('B', { ...base, id: 'B', title: 'Lesson B', content: 'Body B', position: 1, updated_at: stamp() });
  db.set('Q', {
    ...base,
    id: 'Q',
    title: 'Graded quiz',
    content: '',
    type: 'quiz',
    position: 2,
    updated_at: stamp(),
  });
}

function wireService() {
  const svc = CanvasContentService as any;
  vi.spyOn(svc, 'getModules').mockImplementation(async () => [
    { id: 'm1', course_id: 'course-1', title: 'Section 1', position: 0 },
  ]);
  vi.spyOn(svc, 'getContentItems').mockImplementation(async () =>
    Array.from(db.values())
      .sort((a, b) => a.position - b.position)
      .map((r) => ({ ...r })),
  );
  const nullSafe = typeof svc.getLessonDraftRow === 'function';
  // Mirrors the real shared writer: title/content/published/settings only, unconditional.
  vi.spyOn(svc, 'updateContentItem').mockImplementation(async (id: string, u: any) => {
    const kind: Kind = u.content === undefined ? 'side' : 'draft';
    if (kind === 'side') sideAttempts.push({ id, fields: u });
    return gated(id, u, kind, () => {
      const row = db.get(id);
      if (!row) throw new Error('JSON object requested, multiple (or no) rows returned');
      writes.push({ id, kind, title: u.title, content: u.content, published: u.published });
      if (u.title !== undefined) row.title = u.title;
      if (u.content !== undefined) row.content = u.content;
      if (u.published !== undefined) row.published = u.published;
      row.updated_at = stamp();
      return { ...row };
    });
  });
  // Mirrors the authoring writer (40a1f62 and the fix; absent on c5ef453).
  if (typeof svc.saveLessonDraft === 'function') {
    vi.spyOn(svc, 'saveLessonDraft').mockImplementation(
      async (id: string, f: any, expected: string | null) =>
        gated(id, f, 'draft', () => {
          const row = db.get(id);
          if (!row) throw rejected('This lesson was not saved: it no longer exists.');
          if (delayApply({ id, fields: f })) {
            lateApplies.push(() => {
              if (versionMismatch(row, expected, nullSafe)) return; // condition fails at commit time
              writes.push({ id, kind: 'draft', title: f.title, content: f.content });
              row.title = f.title;
              row.content = f.content;
              row.updated_at = stamp();
            });
            throw new TypeError('Failed to fetch');
          }
          if (versionMismatch(row, expected, nullSafe)) throw conflict(row);
          writes.push({ id, kind: 'draft', title: f.title, content: f.content });
          row.title = f.title;
          row.content = f.content;
          row.updated_at = stamp();
          return { id, title: row.title, content: row.content, type: row.type, published: row.published, updated_at: row.updated_at };
        }),
    );
  }
  // Authoritative read and conditional publish writer added by the correction batch.
  if (typeof svc.getLessonDraftRow === 'function') {
    vi.spyOn(svc, 'getLessonDraftRow').mockImplementation(async (id: string) => {
      if (docDead) return never();
      const row = db.get(id);
      return row
        ? { id, title: row.title, content: row.content, type: row.type, published: row.published, updated_at: row.updated_at }
        : null;
    });
  }
  if (typeof svc.setLessonPublished === 'function') {
    vi.spyOn(svc, 'setLessonPublished').mockImplementation(
      async (id: string, published: boolean, expected: string | null) => {
        sideAttempts.push({ id, fields: { published } });
        return gated(id, { published }, 'side', () => {
          const row = db.get(id);
          if (!row) throw rejected('This lesson no longer exists.');
          if (versionMismatch(row, expected, true)) throw conflict(row);
          writes.push({ id, kind: 'side', published });
          row.published = published;
          row.updated_at = stamp();
          return { id, title: row.title, content: row.content, type: row.type, published: row.published, updated_at: row.updated_at };
        });
      },
    );
  }
}

function courseTable() {
  const course = {
    id: 'course-1',
    title: 'Persistence course',
    description: '',
    thumbnail: null,
    image_url: null,
    published: false,
    category: 'Data',
    level: 'Beginner',
    tags: [],
    duration: null,
    estimated_hours: null,
    difficulty_level: null,
    settings: null,
  };
  const b: any = {};
  for (const m of ['select', 'eq', 'update', 'order', 'limit']) b[m] = vi.fn(() => b);
  b.single = vi.fn(() => Promise.resolve({ data: course, error: null }));
  b.maybeSingle = b.single;
  return b;
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

function renderBuilder(url: string) {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/courses/:courseId/builder" element={<CourseBuilder />} />
          <Route path="/courses/:courseId/learn" element={<div data-testid="learn-page" />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </TooltipProvider>,
  );
}

const titleInput = () => screen.getByLabelText('Title') as HTMLInputElement;
const settle = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

function deferredGate() {
  const pending: Array<() => void> = [];
  const failing: Array<(e: Error) => void> = [];
  gate = () =>
    new Promise<void>((resolve, reject) => {
      pending.push(resolve);
      failing.push(reject);
    });
  return {
    count: () => pending.length,
    resolveLast: () => {
      failing.pop();
      pending.pop()!();
    },
    resolveFirst: () => {
      failing.shift();
      pending.shift()!();
    },
    rejectFirst: (e: Error) => {
      pending.shift();
      failing.shift()!(e);
    },
  };
}

/** Every mirrored draft in this tab, whatever key format the source uses. */
function mirroredTitles(): string[] {
  const out: string[] = [];
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i)!;
    if (!k.startsWith('ic.builder.lessonDraft.')) continue;
    try {
      out.push(JSON.parse(window.sessionStorage.getItem(k)!).draft.title);
    } catch {
      /* not a draft */
    }
  }
  return out;
}

async function renameViaOutline(index: number, title: string) {
  fireEvent.click(screen.getAllByRole('button', { name: 'Lesson actions' })[index]);
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
  const input = document.activeElement as HTMLInputElement;
  fireEvent.change(input, { target: { value: title } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('CourseBuilder lesson persistence', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    toastSpy.mockClear();
    tick = 0;
    writes.length = 0;
    sideAttempts.length = 0;
    attempts.length = 0;
    authUserId = 'user-1';
    loseResponse = () => false;
    delayApply = () => false;
    lateApplies.length = 0;
    docDead = false;
    (mockSupabaseClient.auth.getSession as any).mockImplementation(async () => ({
      data: { session: authUserId ? { user: { id: authUserId } } : null },
      error: null,
    }));
    simulatePageReload();
    inFlight = 0;
    maxInFlight = 0;
    gate = () => undefined;
    seed();
    vi.mocked(useCoursePermissions).mockReturnValue({
      canEdit: true,
      isInstructor: true,
      isAdmin: false,
      loading: false,
      error: null,
    } as any);
    (mockSupabaseClient.from as any).mockImplementation(() => courseTable());
    wireService();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('P05: reload of ?view=lesson&lesson=B opens B, not the first lesson', async () => {
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=B');
    await waitFor(() => expect(titleInput().value).toBe('Lesson B'));
    await settle(50);
    expect(titleInput().value).toBe('Lesson B');
    expect(screen.getByTestId('location').textContent).toContain('lesson=B');
  });

  it('P01: an edit made inside the debounce is saved when switching lesson', async () => {
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));

    fireEvent.change(titleInput(), { target: { value: 'Lesson A edited' } });
    // Switch immediately, well under 800 ms.
    fireEvent.click(screen.getByRole('button', { name: 'Lesson B' }));

    await waitFor(() => expect(titleInput().value).toBe('Lesson B'));
    await waitFor(() => expect(db.get('A')!.title).toBe('Lesson A edited'), { timeout: 2500 });
    expect(db.get('B')!.title).toBe('Lesson B');
  });

  it('P01: an edit made inside the debounce is saved before Preview navigates', async () => {
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));

    fireEvent.change(screen.getByLabelText('Lesson body'), { target: { value: 'Body A final' } });
    fireEvent.click(screen.getByRole('link', { name: 'Preview' }));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/courses/course-1/learn'));
    await waitFor(() => expect(db.get('A')!.content).toBe('Body A final'), { timeout: 2500 });
  });

  it('P02: a rejected save is shown as not saved, keeps the draft, and retry persists it', async () => {
    let fail = true;
    gate = () => {
      if (fail) throw rejected('Database unavailable');
    };
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));

    fireEvent.change(titleInput(), { target: { value: 'Never lose me' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not saved/i), {
      timeout: 2500,
    });
    expect(db.get('A')!.title).toBe('Lesson A');
    expect(titleInput().value).toBe('Never lose me');
    expect(screen.queryByText('All changes saved')).not.toBeInTheDocument();

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /retry save/i }));
    await waitFor(() => expect(db.get('A')!.title).toBe('Never lose me'));
    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument());
  });

  it('P02: leaving via Preview with a failed save asks first and does not navigate', async () => {
    gate = () => {
      throw new Error('Failed to fetch');
    };
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));

    fireEvent.change(titleInput(), { target: { value: 'Offline edit' } });
    fireEvent.click(screen.getByRole('link', { name: 'Preview' }));

    await waitFor(() => expect(screen.getByText('Lesson changes are not saved')).toBeInTheDocument(), {
      timeout: 2500,
    });
    expect(screen.getByTestId('location').textContent).toContain('/builder');
    expect(db.get('A')!.title).toBe('Lesson A');
  });

  it('P03: saves resolving in reverse order never leave an older draft on the server', async () => {
    const g = deferredGate();
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));

    fireEvent.change(titleInput(), { target: { value: 'v1' } });
    await settle(950); // first autosave fires and hangs
    fireEvent.change(titleInput(), { target: { value: 'v2' } });
    await settle(950); // second autosave window passes while the first is pending

    // Resolve whatever is pending, newest first, until nothing is left.
    for (let i = 0; i < 6 && (g.count() > 0 || i === 0); i++) {
      await act(async () => {
        if (g.count() > 0) g.resolveLast();
      });
      await settle(50);
    }
    await waitFor(() => expect(g.count()).toBe(0));
    expect(db.get('A')!.title).toBe('v2');
    expect(maxInFlight).toBe(1);
  });

  it('P03: a slow save for A that lands after switching to B never writes into B', async () => {
    const g = deferredGate();
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));

    fireEvent.change(titleInput(), { target: { value: 'A slow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lesson B' }));
    await waitFor(() => expect(titleInput().value).toBe('Lesson B'));
    fireEvent.change(titleInput(), { target: { value: 'B typed' } });

    while (g.count() === 0) await settle(20);
    await act(async () => g.resolveFirst());
    await settle(50);
    expect(titleInput().value).toBe('B typed');
    await waitFor(() => expect(g.count()).toBeGreaterThan(0), { timeout: 2500 });
    await act(async () => g.resolveFirst());
    await waitFor(() => expect(db.get('B')!.title).toBe('B typed'));
    expect(db.get('A')!.title).toBe('A slow');
    expect(writes.filter((w) => w.id === 'B').every((w) => w.title === 'B typed')).toBe(true);
  });

  it('P03: a change saved in another tab is reported as a conflict, not overwritten', async () => {
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));

    // Another tab saves A after we loaded it.
    const other = db.get('A')!;
    other.title = 'Other tab title';
    other.updated_at = stamp();

    fireEvent.change(titleInput(), { target: { value: 'My title' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/changed somewhere else/i), {
      timeout: 2500,
    });
    expect(db.get('A')!.title).toBe('Other tab title');

    fireEvent.click(screen.getByRole('button', { name: 'Keep my version' }));
    await waitFor(() => expect(db.get('A')!.title).toBe('My title'));
  });

  it('P04: lesson type is visibly fixed and a save never changes the stored type', async () => {
    // Open the quiz from the outline (not a deep link) so this case is independent of P05.
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.click(screen.getByRole('button', { name: 'Graded quiz' }));
    await waitFor(() => expect(titleInput().value).toBe('Graded quiz'));

    const typeField = screen.getByLabelText('Type');
    expect(typeField).toBeDisabled();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText(/can't be changed yet/i)).toBeInTheDocument();

    fireEvent.change(titleInput(), { target: { value: 'Graded quiz v2' } });
    await waitFor(() => expect(db.get('Q')!.title).toBe('Graded quiz v2'), { timeout: 2500 });
    expect(db.get('Q')!.type).toBe('quiz');
  });

  it('P02: an unconfirmed draft survives leaving the builder and is restored and saved on return', async () => {
    let fail = true;
    gate = () => {
      if (fail) throw new Error('Failed to fetch');
    };
    const first = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'Draft before reload' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not saved|not confirmed/i), {
      timeout: 2500,
    });
    first.unmount(); // reload: the builder and its in-memory state are gone
    simulatePageReload();

    fail = false;
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Draft before reload'));
    expect(screen.getByText(/restored unsaved changes/i)).toBeInTheDocument();
    await waitFor(() => expect(db.get('A')!.title).toBe('Draft before reload'), { timeout: 2500 });
  });
});

// ---------------------------------------------------------------------------------------------
// Correction batch (bounded review of 40a1f62): R1 side actions, R2 mirror ownership, R3 uncertain
// writes, R4 NULL baseline, and the recovery boundary. Each case names the exact state it targets.
// ---------------------------------------------------------------------------------------------
describe('CourseBuilder lesson persistence: save-state correction batch', () => {
  const offline = () => new TypeError('Failed to fetch');

  beforeEach(() => {
    window.sessionStorage.clear();
    toastSpy.mockClear();
    tick = 0;
    writes.length = 0;
    sideAttempts.length = 0;
    attempts.length = 0;
    authUserId = 'user-1';
    loseResponse = () => false;
    delayApply = () => false;
    lateApplies.length = 0;
    docDead = false;
    (mockSupabaseClient.auth.getSession as any).mockImplementation(async () => ({
      data: { session: authUserId ? { user: { id: authUserId } } : null },
      error: null,
    }));
    simulatePageReload();
    inFlight = 0;
    maxInFlight = 0;
    gate = () => undefined;
    seed();
    vi.mocked(useCoursePermissions).mockReturnValue({
      canEdit: true,
      isInstructor: true,
      isAdmin: false,
      loading: false,
      error: null,
    } as any);
    (mockSupabaseClient.from as any).mockImplementation(() => courseTable());
    wireService();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  async function drain(g: ReturnType<typeof deferredGate>, rounds = 8) {
    for (let i = 0; i < rounds; i++) {
      await settle(900);
      if (g.count() === 0) continue;
      await act(async () => g.resolveFirst());
    }
    await settle(50);
  }

  it('R1a: failed save, then rename from the outline: no write of any kind, draft kept', async () => {
    gate = ({ kind }) => {
      if (kind === 'draft') throw rejected('Database unavailable');
    };
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(screen.getByLabelText('Lesson body'), { target: { value: 'Unsaved body' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not saved/i), { timeout: 2500 });

    const before = attempts.length;
    fireEvent.click(screen.getByRole('button', { name: 'Go to curriculum' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lesson actions' }).length).toBeGreaterThan(0));
    await renameViaOutline(0, 'Renamed while failed');
    await settle(1200);

    expect(sideAttempts).toHaveLength(0);
    expect(attempts.slice(before)).toHaveLength(0);
    expect(db.get('A')!.title).toBe('Lesson A');
    expect(db.get('A')!.content).toBe('Body A');
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Lesson not renamed' }));
  });

  it('R1b: conflicted save, then Unpublish: no write of any kind, publish state unchanged', async () => {
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    const other = db.get('A')!;
    other.title = 'Other tab title';
    other.updated_at = stamp();
    fireEvent.change(titleInput(), { target: { value: 'My title' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/changed somewhere else/i), {
      timeout: 2500,
    });

    const before = attempts.length;
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await settle(1200);

    expect(sideAttempts).toHaveLength(0);
    expect(attempts.slice(before)).toHaveLength(0);
    expect(db.get('A')!.published).toBe(true);
    expect(db.get('A')!.title).toBe('Other tab title');
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Lesson not unpublished' }));
  });

  it('R1c: two renames whose responses would arrive in reverse order end at the last rename', async () => {
    const g = deferredGate();
    renderBuilder('/courses/course-1/builder?view=curriculum');
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lesson actions' }).length).toBeGreaterThan(0));
    await renameViaOutline(0, 'Rename one');
    await settle(20);
    await renameViaOutline(0, 'Rename two');
    await settle(20);

    // Resolve whatever is pending, newest first, until nothing is left.
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        if (g.count() > 0) g.resolveLast();
      });
      await settle(60);
    }
    expect(g.count()).toBe(0);
    expect(db.get('A')!.title).toBe('Rename two');
    expect(maxInFlight).toBe(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rename two' })).toBeInTheDocument());
  });

  it('R1d: a held rename, then a body edit in the editor: both persist and the rename is not reverted', async () => {
    const g = deferredGate();
    renderBuilder('/courses/course-1/builder?view=curriculum');
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lesson actions' }).length).toBeGreaterThan(0));
    await renameViaOutline(0, 'Renamed A');
    await waitFor(() => expect(g.count()).toBe(1));

    // Open the lesson while the rename is still in flight and edit the body.
    fireEvent.click(screen.getAllByRole('button', { name: /^(Lesson A|Renamed A)$/ })[0]);
    await waitFor(() => expect(screen.getByLabelText('Lesson body')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Lesson body'), { target: { value: 'Body after rename' } });
    await drain(g);

    expect(g.count()).toBe(0);
    expect(db.get('A')!.title).toBe('Renamed A');
    expect(db.get('A')!.content).toBe('Body after rename');
    expect(writes.filter((w) => w.id === 'A' && w.title !== undefined).map((w) => w.title)).not.toContain('Lesson A');
    expect(titleInput().value).toBe('Renamed A');
  }, 20000);

  it('R2a: an old save that SUCCEEDS after remount and a newer edit leaves the newest draft mirrored and restorable', async () => {
    const g = deferredGate();
    const first = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'v1' } });
    await waitFor(() => expect(g.count()).toBe(1), { timeout: 2500 });
    first.unmount(); // in-app Back while v1 is in flight; same tab, no reload

    const second = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('v1'));
    fireEvent.change(titleInput(), { target: { value: 'v2' } });
    await settle(20);
    await act(async () => g.resolveFirst()); // the old v1 write succeeds now
    await settle(30);
    expect(mirroredTitles()).toEqual(['v2']);

    // v1 completing starts the queued v2 send; resetting the registry does not settle its gate.
    await waitFor(() => expect(g.count()).toBe(1));
    expect(inFlight).toBe(1);
    second.unmount();
    epoch += 1; // The old document cannot receive callbacks after this simulated full reload.
    simulatePageReload();
    gate = () => undefined;
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('v2'));
    await waitFor(() => expect(db.get('A')!.title).toBe('v2'), { timeout: 2500 });

    // End the old synthetic transport explicitly instead of leaking it into the next test.
    // Its lost-document rejection must not alter the replacement document's data or mirror.
    const savedRow = JSON.stringify(db.get('A'));
    const savedMirrors = mirroredTitles();
    await act(async () => g.rejectFirst(rejected('Synthetic old-document connection closed')));
    await waitFor(() => expect(inFlight).toBe(0));
    expect(g.count()).toBe(0);
    expect(JSON.stringify(db.get('A'))).toBe(savedRow);
    expect(mirroredTitles()).toEqual(savedMirrors);
  });

  it('R2b: an old save that FAILS after remount and a newer edit never overwrites the newer mirror', async () => {
    const g = deferredGate();
    const first = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'v1' } });
    await waitFor(() => expect(g.count()).toBe(1), { timeout: 2500 });
    first.unmount();

    const second = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('v1'));
    fireEvent.change(titleInput(), { target: { value: 'v2' } });
    await settle(20);
    await act(async () => g.rejectFirst(rejected('Database unavailable'))); // the old v1 write fails now
    await settle(30);
    expect(mirroredTitles()).toEqual(['v2']);

    second.unmount();
    simulatePageReload();
    gate = () => undefined;
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('v2'));
    await waitFor(() => expect(db.get('A')!.title).toBe('v2'), { timeout: 2500 });
  });

  it('R3a: a save that applied but whose response was lost: Undo is not marked saved until the server confirms it', async () => {
    let lost = 0;
    loseResponse = ({ kind }) => kind === 'draft' && lost++ === 0;
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'Applied B' } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 2500 });
    expect(db.get('A')!.title).toBe('Applied B'); // the write DID apply

    // The author undoes back to the last confirmed title while the server holds "Applied B".
    fireEvent.change(titleInput(), { target: { value: 'Lesson A' } });
    await settle(100);
    expect(screen.queryByText('All changes saved')).not.toBeInTheDocument();
    expect(mirroredTitles()).toContain('Lesson A');

    await waitFor(() => expect(db.get('A')!.title).toBe('Lesson A'), { timeout: 2500 });
    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument());
    // Exactly the author's two intents were written; nothing was sent to "compensate".
    expect(writes.filter((w) => w.id === 'A').map((w) => w.title)).toEqual(['Applied B', 'Lesson A']);

    cleanup();
    simulatePageReload();
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
  });

  it('R3b: Retry after an applied-but-lost save reconciles by reading, with no second write and no false conflict', async () => {
    let lost = 0;
    loseResponse = ({ kind }) => kind === 'draft' && lost++ === 0;
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'Applied B' } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 2500 });

    fireEvent.click(screen.getByRole('button', { name: /retry save/i }));
    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument(), { timeout: 2500 });
    expect(screen.queryByText(/changed somewhere else|not the one you last saw/i)).not.toBeInTheDocument();
    expect(writes.filter((w) => w.id === 'A').map((w) => w.title)).toEqual(['Applied B']);
  });

  it('R4a: NULL baseline plus an intervening update is a conflict, not an overwrite', async () => {
    db.get('A')!.updated_at = null;
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    const other = db.get('A')!;
    other.title = 'Other tab title';
    other.updated_at = stamp(); // the BEFORE UPDATE trigger sets NOW() on the other write

    fireEvent.change(titleInput(), { target: { value: 'Mine' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/changed somewhere else/i), {
      timeout: 2500,
    });
    expect(db.get('A')!.title).toBe('Other tab title');
  });

  it('R4b (guard, not causal): NULL baseline with no intervening change saves through the null-safe condition', async () => {
    db.get('A')!.updated_at = null;
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'Mine' } });
    await waitFor(() => expect(db.get('A')!.title).toBe('Mine'), { timeout: 2500 });
    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument());
  });

  it('R4c: a restored draft taken on a NULL base is a conflict when the lesson changed meanwhile', async () => {
    db.get('A')!.updated_at = null;
    gate = ({ kind }) => {
      if (kind === 'draft') throw rejected('Database unavailable');
    };
    const first = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'Mine draft' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not saved/i), { timeout: 2500 });
    first.unmount();
    simulatePageReload();

    const other = db.get('A')!;
    other.title = 'Other tab title';
    other.updated_at = stamp();
    gate = () => undefined;
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Mine draft'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/may have changed since/i));
    await settle(1200);
    expect(db.get('A')!.title).toBe('Other tab title');
  });

  it('B1: a sessionStorage getter that throws does not break the builder, and the UI says drafts cannot be kept', async () => {
    const own = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    try {
      gate = ({ kind }) => {
        if (kind === 'draft') throw rejected('Database unavailable');
      };
      renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
      await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
      fireEvent.change(titleInput(), { target: { value: 'Nowhere to keep this' } });
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/cannot store them/i), {
        timeout: 2500,
      });
    } finally {
      if (own) Object.defineProperty(window, 'sessionStorage', own);
      else delete (window as any).sessionStorage;
    }
  });

  it('B2: a failed mirror write is reported honestly: leaving warns that changes will be lost', async () => {
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k.startsWith('ic.builder.lessonDraft.') && !k.endsWith('probe')) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return realSet.call(this, k, v);
    });
    gate = ({ kind }) => {
      if (kind === 'draft') throw offline();
    };
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'Unstorable edit' } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 2500 });
    fireEvent.click(screen.getByRole('link', { name: 'Preview' }));
    await waitFor(() => expect(screen.getByText('Lesson changes are not saved')).toBeInTheDocument(), {
      timeout: 2500,
    });
    expect(screen.getByText(/will be lost/i)).toBeInTheDocument();
    expect(screen.queryByText(/offered again/i)).not.toBeInTheDocument();
  });

  it('B3: same tab, user 1 then user 2: user 2 never sees or saves user 1\'s draft, and user 1 recovers it on return', async () => {
    gate = ({ kind }) => {
      if (kind === 'draft') throw rejected('Database unavailable');
    };
    const first = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'User 1 private draft' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not saved/i), { timeout: 2500 });
    first.unmount();

    authUserId = null; // sign-out
    authUserId = 'user-2';
    gate = () => undefined;
    const second = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    await settle(1200);
    expect(titleInput().value).toBe('Lesson A');
    expect(screen.queryByText(/restored unsaved changes/i)).not.toBeInTheDocument();
    expect(attempts.filter((a) => a.as !== 'user-1')).toHaveLength(0);
    expect(db.get('A')!.title).toBe('Lesson A');
    expect(mirroredTitles()).toContain('User 1 private draft'); // preserved for its owner, not purged
    second.unmount();

    authUserId = 'user-1'; // user 1 comes back after a reload
    simulatePageReload();
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('User 1 private draft'));
    await waitFor(() => expect(db.get('A')!.title).toBe('User 1 private draft'), { timeout: 2500 });
    expect(attempts.filter((a) => a.fields?.title === 'User 1 private draft').every((a) => a.as === 'user-1')).toBe(true);
  });

  it('B5: user 1 failed draft, sign-out, user 2 opens a builder they may not edit: nothing shown or written, user 1 recovers', async () => {
    gate = ({ kind }) => {
      if (kind === 'draft') throw rejected('Database unavailable');
    };
    const first = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'User 1 private draft' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not saved/i), { timeout: 2500 });
    first.unmount();

    authUserId = 'user-2';
    gate = () => undefined;
    vi.mocked(useCoursePermissions).mockReturnValue({
      canEdit: false,
      isInstructor: false,
      isAdmin: false,
      loading: false,
      error: null,
    } as any);
    const denied = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(screen.getByText('Not authorized')).toBeInTheDocument());
    await settle(1200);
    expect(screen.queryByText(/User 1 private draft/)).not.toBeInTheDocument();
    expect(attempts.filter((a) => a.as !== 'user-1')).toHaveLength(0);
    expect(mirroredTitles()).toContain('User 1 private draft');
    denied.unmount();

    authUserId = 'user-1';
    vi.mocked(useCoursePermissions).mockReturnValue({
      canEdit: true,
      isInstructor: true,
      isAdmin: false,
      loading: false,
      error: null,
    } as any);
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('User 1 private draft'));
    fireEvent.click(screen.getByRole('button', { name: /retry save/i }));
    await waitFor(() => expect(db.get('A')!.title).toBe('User 1 private draft'), { timeout: 2500 });
  });

  it('B4: a mirrored draft is neither restored nor written while edit permission is not confirmed; the owner\'s draft is kept', async () => {
    const base = db.get('A')!.updated_at;
    const draft = { title: 'Stale draft', content: 'Body A' };
    // Seed the draft in both formats so the identical test exercises old and new source.
    window.sessionStorage.setItem('ic.builder.lessonDraft.course-1.A', JSON.stringify({ draft, baseUpdatedAt: base }));
    const ownKey = 'ic.builder.lessonDraft.v2.user-1:course-1.A';
    window.sessionStorage.setItem(ownKey, JSON.stringify({ v: 2, owner: 'earlier-page', draft, base: { known: true, value: base } }));
    vi.mocked(useCoursePermissions).mockReturnValue({
      canEdit: false,
      isInstructor: false,
      isAdmin: false,
      loading: false,
      error: null,
    } as any);

    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(screen.getByText('Not authorized')).toBeInTheDocument());
    await settle(1500);
    expect(attempts).toHaveLength(0);
    expect(db.get('A')!.title).toBe('Lesson A');
    expect(window.sessionStorage.getItem(ownKey)).not.toBeNull();
    // The legacy unscoped mirror cannot be attributed to a user: it is neither rendered nor deleted.
    expect(window.sessionStorage.getItem('ic.builder.lessonDraft.course-1.A')).not.toBeNull();
  });

  // ---------------- second correction batch (native recheck of 91b99ad) ----------------

  it('F1: send B, transport error while the server still holds it, Undo to A, read shows A: a fence write, so the late B can never commit', async () => {
    let first = true;
    delayApply = ({ fields }) => {
      if (first && fields.title === 'B pending') {
        first = false;
        return true;
      }
      return false;
    };
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'B pending' } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 2500 });
    expect(db.get('A')!.title).toBe('Lesson A'); // B has not committed yet

    fireEvent.change(titleInput(), { target: { value: 'Lesson A' } }); // Undo
    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument(), { timeout: 2500 });
    // "Saved" was earned by a conditional write of A, not by reading A back.
    expect(attempts.filter((a) => a.id === 'A' && a.fields?.title === 'Lesson A').length).toBeGreaterThan(0);

    await act(async () => releaseLate()); // the original B finally reaches commit
    await settle(50);
    expect(db.get('A')!.title).toBe('Lesson A');
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('F2: a transport error code (ECONNRESET) after the write applied is uncertain, not a definitive rejection', async () => {
    let lost = 0;
    loseResponse = ({ kind }) =>
      kind === 'draft' && lost++ === 0 ? Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }) : false;
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'Applied B' } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 2500 });
    expect(db.get('A')!.title).toBe('Applied B');

    fireEvent.change(titleInput(), { target: { value: 'Lesson A' } }); // Undo
    await settle(100);
    expect(screen.queryByText('All changes saved')).not.toBeInTheDocument();
    await waitFor(() => expect(db.get('A')!.title).toBe('Lesson A'), { timeout: 2500 });
    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument());
  });

  async function heldWriteThenSwitchUser(outcome: 'success' | 'failure') {
    const g = deferredGate();
    const first = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'Private v1' } });
    await waitFor(() => expect(g.count()).toBe(1), { timeout: 2500 });
    fireEvent.change(titleInput(), { target: { value: 'Private v2' } }); // newer draft queued behind v1
    first.unmount();
    authUserId = null; // user 1 signs out
    authUserId = 'user-2'; // user 2 signs in; no builder is opened
    toastSpy.mockClear();
    const before = attempts.length;
    gate = () => undefined;
    await act(async () => (outcome === 'success' ? g.resolveFirst() : g.rejectFirst(rejected('Database unavailable'))));
    await settle(1500);
    return { after: attempts.slice(before) };
  }
  const privateToasts = () =>
    toastSpy.mock.calls.filter((c) => JSON.stringify(c[0] ?? {}).includes('Private'));

  it('O1: user 1\'s held write SUCCEEDS after user 2 signed in (no builder): no further user 1 write under user 2, user 1 recovers', async () => {
    const { after } = await heldWriteThenSwitchUser('success');
    expect(after).toHaveLength(0);
    expect(privateToasts()).toHaveLength(0);
    expect(db.get('A')!.title).toBe('Private v1');
    expect(mirroredTitles()).toContain('Private v2');

    authUserId = 'user-1';
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Private v2'));
    await waitFor(() => expect(db.get('A')!.title).toBe('Private v2'), { timeout: 2500 });
    expect(attempts.filter((a) => a.fields?.title?.startsWith('Private')).every((a) => a.as === 'user-1')).toBe(true);
  });

  it('O2: user 1\'s held write FAILS after user 2 signed in (no builder): no private toast, no write, the draft is kept for user 1', async () => {
    const { after } = await heldWriteThenSwitchUser('failure');
    expect(after).toHaveLength(0);
    expect(privateToasts()).toHaveLength(0);
    expect(db.get('A')!.title).toBe('Lesson A');
    expect(mirroredTitles()).toContain('Private v2');

    authUserId = 'user-1';
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Private v2'));
  });

  // ---------------- third batch: durability across document loss ----------------

  /** The page dies without an unload flush; a fresh page in the same tab (same sessionStorage) follows. */
  async function crash(r: { unmount: () => void }) {
    docDead = true;
    r.unmount();
    await settle(30);
    simulatePageReload();
    epoch += 1;
    docDead = false;
  }
  const restoredSaved = () => screen.queryByText('All changes saved');

  async function sendBThenUndo(mode: 'error-arrived' | 'in-flight') {
    let release: (() => void) | null = null;
    if (mode === 'error-arrived') {
      let first = true;
      delayApply = ({ fields }) => {
        if (first && fields.title === 'B pending') {
          first = false;
          return true;
        }
        return false;
      };
    } else {
      gate = ({ fields, kind }) => {
        if (kind === 'draft' && fields.title === 'B pending' && !release) {
          return new Promise<void>((res) => {
            release = res;
          });
        }
      };
    }
    const page = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'B pending' } });
    if (mode === 'error-arrived') {
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 2500 });
    } else {
      await waitFor(() => expect(release).not.toBeNull(), { timeout: 2500 });
    }
    fireEvent.change(titleInput(), { target: { value: 'Lesson A' } }); // Undo, then the page dies before any fence
    await settle(20);
    expect(db.get('A')!.title).toBe('Lesson A');
    await crash(page);
    gate = () => undefined;
    return { releaseHeld: () => release?.() };
  }

  it('D1: error arrived, Undo, crash before the fence; fresh page fences; the late original LOSES', async () => {
    await sendBThenUndo('error-arrived');
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    await settle(100);
    expect(restoredSaved()).not.toBeInTheDocument(); // equal fields are not settlement
    expect(mirroredTitles()).toContain('Lesson A');
    await waitFor(() => expect(restoredSaved()).toBeInTheDocument(), { timeout: 2500 });
    await act(async () => releaseLate());
    await settle(50);
    expect(db.get('A')!.title).toBe('Lesson A');
    expect(mirroredTitles()).toEqual([]);
  });

  it('D2: error arrived, Undo, crash; the late original WINS before the fresh page settles; A is still written, no false conflict', async () => {
    await sendBThenUndo('error-arrived');
    await act(async () => releaseLate()); // B commits while no page is open
    expect(db.get('A')!.title).toBe('B pending');
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(db.get('A')!.title).toBe('Lesson A'), { timeout: 2500 });
    await waitFor(() => expect(restoredSaved()).toBeInTheDocument());
    expect(screen.queryByText(/changed somewhere else|may have changed since|not the one you last saw/i)).not.toBeInTheDocument();
  });

  it('D3: still in flight (no error yet), Undo, crash; fresh page fences; the original commits late and LOSES', async () => {
    const { releaseHeld } = await sendBThenUndo('in-flight');
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    await settle(100);
    expect(restoredSaved()).not.toBeInTheDocument();
    await waitFor(() => expect(restoredSaved()).toBeInTheDocument(), { timeout: 2500 });
    await act(async () => releaseHeld());
    await settle(50);
    expect(db.get('A')!.title).toBe('Lesson A');
  });

  it('D4: still in flight, Undo, crash; the original WINS right after the fresh page loads; A is still written', async () => {
    const { releaseHeld } = await sendBThenUndo('in-flight');
    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    await act(async () => releaseHeld()); // B commits after the fresh page fetched A/t1
    await settle(30);
    expect(db.get('A')!.title).toBe('B pending');
    await waitFor(() => expect(db.get('A')!.title).toBe('Lesson A'), { timeout: 2500 });
    await waitFor(() => expect(restoredSaved()).toBeInTheDocument());
  });

  it('D5: crash DURING the fence; fresh page fences again; the old fence and the late original both LOSE', async () => {
    let first = true;
    delayApply = ({ fields }) => {
      if (first && fields.title === 'B pending') {
        first = false;
        return true;
      }
      return false;
    };
    let releaseFence: (() => void) | null = null;
    gate = ({ fields, kind }) => {
      if (kind === 'draft' && fields.title === 'Lesson A' && !releaseFence) {
        return new Promise<void>((res) => {
          releaseFence = res;
        });
      }
    };
    const page = renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    fireEvent.change(titleInput(), { target: { value: 'B pending' } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 2500 });
    fireEvent.change(titleInput(), { target: { value: 'Lesson A' } });
    const fenceSent = await waitFor(() => {
      if (!releaseFence) throw new Error('no fence yet');
      return true;
    }, { timeout: 2500 }).catch(() => false);
    await crash(page);
    gate = () => undefined;

    renderBuilder('/courses/course-1/builder?view=lesson&lesson=A');
    await waitFor(() => expect(titleInput().value).toBe('Lesson A'));
    await settle(100);
    expect(restoredSaved()).not.toBeInTheDocument();
    await waitFor(() => expect(restoredSaved()).toBeInTheDocument(), { timeout: 2500 });
    await act(async () => {
      if (releaseFence) (releaseFence as () => void)();
      releaseLate();
    });
    await settle(50);
    expect(db.get('A')!.title).toBe('Lesson A');
    expect(fenceSent).toBe(true);
  });
});

