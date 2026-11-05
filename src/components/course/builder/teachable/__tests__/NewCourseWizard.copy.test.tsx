// ABOUTME: T-18. The wizard offers no outline method that does nothing: "Copy from another course" copies the chosen
// ABOUTME: course's sections and lessons; stale, foreign, partial or credential-bearing copies are refused with no write.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NewCourseWizard } from '../NewCourseWizard';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { createFakeDb, type FakeDb } from '@/components/course/builder/__tests__/fakeCreationDb';
import { planFor, runCreationPlan } from '@/components/course/builder/courseCreation';
import {
  COPY_LIMITS,
  CopyReadError,
  CopyUnsupportedContentError,
  hasCredentialReference,
  listCopyableCourses,
  loadCourseOutline,
} from '@/components/course/builder/copyCourseOutline';

let db: FakeDb;

// Reads go through a PostgREST-shaped wrapper over the fake: it honours limit(), returns the exact pre-limit
// count when asked, and can shorten replies (a server row cap), drop the count, fail a table, or hold a read
// at a gate until the test releases it.
interface Gate { arrived: boolean; release: () => void; promise: Promise<void> }
const newGate = (): Gate => {
  let release!: () => void;
  const promise = new Promise<void>((r) => (release = r));
  return { arrived: false, release, promise };
};
let ctl: {
  cap: number | null;
  noCount: Set<string>;
  failMany: Map<string, string>;
  failOwnership: string | null;
  gate: Map<string, Gate>;
  reads: string[];
};

const reader = {
  from(t: string) {
    const b = db.client.from(t);
    let wantCount = false;
    let lim: number | null = null;
    const sel = b.select;
    b.select = (cols?: string, o?: { count?: string }) => ((wantCount = !!o?.count), sel(cols, o), b);
    b.limit = (n: number) => ((lim = n), b);
    const then0 = b.then;
    const hold = async () => {
      const g = ctl.gate.get(t);
      if (g) {
        g.arrived = true;
        await g.promise;
      }
    };
    b.then = (ok: any, bad: any) =>
      new Promise<any>((r) => then0.call(b, r))
        .then(async (res: any) => {
          ctl.reads.push(t);
          await hold();
          const fail = ctl.failMany.get(t);
          if (fail) return { data: null, error: { message: fail }, count: null };
          let rows = res.data as any[];
          const count = rows.length;
          if (lim != null) rows = rows.slice(0, lim);
          if (ctl.cap != null) rows = rows.slice(0, ctl.cap);
          return { ...res, data: rows, count: wantCount && !ctl.noCount.has(t) ? count : null };
        })
        .then(ok, bad);
    const ms = b.maybeSingle;
    b.maybeSingle = async () => {
      ctl.reads.push(`${t}:one`);
      await hold();
      if (t === 'courses' && ctl.failOwnership) return { data: null, error: { message: ctl.failOwnership } };
      return ms();
    };
    return b;
  },
};

const signedInAs = (id: string | null) =>
  (mockSupabaseClient.auth.getUser as any).mockResolvedValue({ data: { user: id ? { id } : null }, error: null });

// The destination write path the builder page uses: the plan is bound to the signed-in user (T-56).
const finish = vi.fn(async (r: any) => {
  const { data } = await mockSupabaseClient.auth.getUser();
  const uid = data.user?.id ?? null;
  const plan = planFor(null, r, uid);
  await runCreationPlan({ plan, result: r, instructorId: uid, client: db.client, report: { step: () => {} } });
});

const SEEDED_COURSES = 3;
const courseCount = () => db.tables.courses.size;
const createdItems = () => [...db.tables.content_items.values()].filter((i) => !['i1', 'i2', 'i3', 'j1'].includes(i.id));

beforeEach(() => {
  db = createFakeDb();
  ctl = { cap: null, noCount: new Set(), failMany: new Map(), failOwnership: null, gate: new Map(), reads: [] };
  db.tables.courses.set('src-1', { id: 'src-1', title: 'Source course', instructor_id: 'u1' });
  db.tables.courses.set('src-2', { id: 'src-2', title: 'Second source', instructor_id: 'u1' });
  db.tables.courses.set('other', { id: 'other', title: 'Someone else', instructor_id: 'u2' });
  db.tables.modules.set('sm2', { id: 'sm2', course_id: 'src-1', title: 'Second', position: 1 });
  db.tables.modules.set('sm1', { id: 'sm1', course_id: 'src-1', title: 'First', position: 0 });
  db.tables.modules.set('tm1', { id: 'tm1', course_id: 'src-2', title: 'Other first', position: 0 });
  db.tables.content_items.set('i3', { id: 'i3', course_id: 'src-1', module_id: 'sm2', title: 'Essay', type: 'assignment', content: '<p>Write</p>', position: 0 });
  db.tables.content_items.set('i2', { id: 'i2', course_id: 'src-1', module_id: 'sm1', title: 'Two', type: 'quiz', content: '', position: 1 });
  db.tables.content_items.set('i1', { id: 'i1', course_id: 'src-1', module_id: 'sm1', title: 'One', type: 'page', content: '<p>Hello</p>', position: 0 });
  db.tables.content_items.set('j1', { id: 'j1', course_id: 'src-2', module_id: 'tm1', title: 'Other lesson', type: 'page', content: '<p>Other</p>', position: 0 });
  (mockSupabaseClient.from as any).mockImplementation((t: string) => reader.from(t));
  signedInAs('u1');
  finish.mockClear();
});

function toOutlineStep() {
  fireEvent.change(screen.getByPlaceholderText('Give it a name'), { target: { value: 'Copied course' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Outline your course')).toBeInTheDocument();
}
const continueBtn = () => screen.getByRole('button', { name: 'Continue' });
async function openCopy() {
  fireEvent.click(screen.getByText('Copy from another course'));
  const select = (await screen.findByLabelText('Course to copy')) as HTMLSelectElement;
  await waitFor(() => expect(select.disabled).toBe(false));
  return select;
}
async function adopt(id = 'src-1') {
  const select = await openCopy();
  fireEvent.change(select, { target: { value: id } });
  await waitFor(() => expect(continueBtn()).not.toBeDisabled());
  return select;
}
async function createFromConfirm() {
  fireEvent.click(continueBtn());
  expect(screen.getByText('Review and create')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Create course' }));
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('T-18 wizard outline methods', () => {
  it('K1 "Bulk upload" is not offered', () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={vi.fn()} />);
    toOutlineStep();
    expect(screen.queryByText('Bulk upload')).not.toBeInTheDocument();
  });

  it('K2 copy lists only my courses, and creating passes the source sections, lessons and lesson text in order', async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={onFinish} />);
    toOutlineStep();
    const select = await openCopy();
    // Only my courses (the fake does not sort text; the server orders by title).
    expect([...select.options].map((o) => o.textContent).sort()).toEqual(['Choose a course', 'Second source', 'Source course']);
    fireEvent.change(select, { target: { value: 'src-1' } });
    await waitFor(() => expect(continueBtn()).not.toBeDisabled());
    await createFromConfirm();
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    const result = onFinish.mock.calls[0][0];
    expect(result.outlineMethod).toBe('copy');
    expect(result.outline).toEqual([
      { title: 'First', lessons: [{ title: 'One', type: 'page', content: '<p>Hello</p>' }, { title: 'Two', type: 'quiz', content: '' }] },
      { title: 'Second', lessons: [{ title: 'Essay', type: 'assignment', content: '<p>Write</p>' }] },
    ]);
  });

  it('K3 copy with no course chosen cannot continue (no empty "success")', async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={onFinish} />);
    toOutlineStep();
    fireEvent.click(screen.getByText('Copy from another course'));
    await screen.findByLabelText('Course to copy');
    expect(continueBtn()).toBeDisabled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('K4 a course list that fails to load is shown as an error, and continuing stays blocked', async () => {
    ctl.failMany.set('courses', 'permission denied');
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={vi.fn()} />);
    toOutlineStep();
    fireEvent.click(screen.getByText('Copy from another course'));
    expect(await screen.findByText(/permission denied/)).toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
  });
});

describe('T-18 r2 A: a copy result applies only to the current intent, account and owned source', () => {
  it('A1 copy -> scratch while the source read is in flight: the late outline is dropped and only the scratch outline is created', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    const g = newGate();
    ctl.gate.set('modules', g);
    fireEvent.change(select, { target: { value: 'src-1' } });
    await waitFor(() => expect(g.arrived).toBe(true));
    fireEvent.click(screen.getByText('Start from scratch'));
    g.release();
    await flush();
    await createFromConfirm();
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
    expect(finish.mock.calls[0][0].outlineMethod).toBe('scratch');
    expect(createdItems().map((i) => i.title)).toEqual(['Introduction']);
  });

  it('A2 copy (adopted) -> scratch does not carry the copied outline into scratch', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    await adopt('src-1');
    fireEvent.click(screen.getByText('Start from scratch'));
    await createFromConfirm();
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
    expect(finish.mock.calls[0][0].outline).toEqual([{ title: 'Section 1', lessons: [{ title: 'Introduction', type: 'page' }] }]);
  });

  it('A2b copy (adopted) -> AI does not carry the copied outline into AI', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    await adopt('src-1');
    fireEvent.click(screen.getByText('Generate with AI'));
    fireEvent.change(screen.getByPlaceholderText(/Add a strong course description/), { target: { value: 'A long enough description' } });
    expect(screen.queryByDisplayValue('First')).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('A3 copy -> AI while the source read is in flight: no copied outline appears and nothing can be created', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    const g = newGate();
    ctl.gate.set('content_items', g);
    fireEvent.change(select, { target: { value: 'src-1' } });
    await waitFor(() => expect(g.arrived).toBe(true));
    fireEvent.click(screen.getByText('Generate with AI'));
    g.release();
    await flush();
    expect(screen.queryByDisplayValue('First')).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('A4 AI -> copy while an AI draft is in flight: the late draft does not land in the copy', async () => {
    let releaseAi!: (v: any) => void;
    (mockSupabaseClient.functions.invoke as any).mockReturnValue(new Promise((r) => (releaseAi = r)));
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    fireEvent.change(screen.getByPlaceholderText(/Add a strong course description/), { target: { value: 'A long enough description' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate outline/ }));
    await openCopy();
    await act(async () => releaseAi({ data: { sections: [{ title: 'AI section', lessons: [] }] }, error: null }));
    await flush();
    expect(screen.queryByDisplayValue('AI section')).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
  });

  it('A5 (handler control: the select is disabled while loading, so a user cannot do this) clearing the course while its read is in flight leaves no outline and blocks continuing', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    const g = newGate();
    ctl.gate.set('modules', g);
    fireEvent.change(select, { target: { value: 'src-1' } });
    await waitFor(() => expect(g.arrived).toBe(true));
    fireEvent.change(select, { target: { value: '' } });
    g.release();
    await flush();
    expect(screen.queryByDisplayValue('First')).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
  });

  it('A6 (handler control: the select is disabled while loading, so a user cannot do this) reselecting: the slower read of the first course never replaces the second course, and only the second is created', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    const g = newGate();
    ctl.gate.set('modules', g);
    fireEvent.change(select, { target: { value: 'src-1' } });
    await waitFor(() => expect(g.arrived).toBe(true));
    ctl.gate.delete('modules');
    fireEvent.change(select, { target: { value: 'src-2' } });
    await waitFor(() => expect(screen.getByDisplayValue('Other first')).toBeInTheDocument());
    g.release();
    await flush();
    expect(screen.queryByDisplayValue('First')).not.toBeInTheDocument();
    expect(continueBtn()).not.toBeDisabled();
    await createFromConfirm();
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
    expect(createdItems().map((i) => [i.title, i.content])).toEqual([['Other lesson', '<p>Other</p>']]);
  });

  it('A7 re-entering copy re-lists for the current account and starts with no outline', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    await adopt('src-1');
    fireEvent.click(screen.getByText('Start from scratch'));
    const listsBefore = ctl.reads.filter((r) => r === 'courses').length;
    const select = await openCopy();
    expect(ctl.reads.filter((r) => r === 'courses').length).toBe(listsBefore + 1);
    expect(select.value).toBe('');
    expect(screen.queryByDisplayValue('First')).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
  });

  it('A8 an account change between listing and picking is refused before the source is read', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    signedInAs('u2');
    fireEvent.change(select, { target: { value: 'src-1' } });
    expect(await screen.findByText(/different account/)).toBeInTheDocument();
    expect(ctl.reads).not.toContain('modules');
    expect(continueBtn()).toBeDisabled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('A9 an account change after the outline was adopted is refused at Create, with no destination write', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    await adopt('src-1');
    signedInAs('u2');
    await createFromConfirm();
    expect(await screen.findByText(/different account/)).toBeInTheDocument();
    expect(finish).not.toHaveBeenCalled();
    expect(courseCount()).toBe(SEEDED_COURSES);
    expect(createdItems()).toEqual([]);
  });

  it('A10 a source no longer owned by me at Create is refused, with no destination write', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    await adopt('src-1');
    db.tables.courses.get('src-1').instructor_id = 'u3';
    await createFromConfirm();
    expect(await screen.findByText(/not one of your courses/)).toBeInTheDocument();
    expect(finish).not.toHaveBeenCalled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('A11 signed out at Create is refused, with no destination write', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    await adopt('src-1');
    signedInAs(null);
    await createFromConfirm();
    expect(await screen.findByText(/Sign in again/)).toBeInTheDocument();
    expect(finish).not.toHaveBeenCalled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('A12 closing the wizard while a read is in flight discards it; reopening shows no outline', async () => {
    const { rerender } = render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    const g = newGate();
    ctl.gate.set('modules', g);
    fireEvent.change(select, { target: { value: 'src-1' } });
    await waitFor(() => expect(g.arrived).toBe(true));
    rerender(<NewCourseWizard open={false} onCancel={vi.fn()} onFinish={finish} />);
    g.release();
    await flush();
    rerender(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    expect(screen.queryByDisplayValue('First')).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('A13 positive: an adopted copy creates one destination owned by me with the lesson text verbatim', async () => {
    db.tables.content_items.get('i1').content = '<p>See <a href="https://docs.example.org/guide?page=2#intro">the guide</a></p>';
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    await adopt('src-1');
    await createFromConfirm();
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(courseCount()).toBe(SEEDED_COURSES + 1));
    const dest = [...db.tables.courses.values()].find((c) => !['src-1', 'src-2', 'other'].includes(c.id));
    expect(dest.instructor_id).toBe('u1');
    expect(createdItems().map((i) => [i.title, i.content])).toEqual([
      ['One', '<p>See <a href="https://docs.example.org/guide?page=2#intro">the guide</a></p>'],
      ['Two', ''],
      ['Essay', '<p>Write</p>'],
    ]);
  });

  it('A14 an account switch while the course list is loading: no list, no loading left, nothing adopted or written', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const g = newGate();
    ctl.gate.set('courses', g);
    fireEvent.click(screen.getByText('Copy from another course'));
    await waitFor(() => expect(g.arrived).toBe(true));
    signedInAs('u2');
    g.release();
    expect(await screen.findByText(/different account/)).toBeInTheDocument();
    const select = screen.getByLabelText('Course to copy') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect([...select.options].map((o) => o.value)).toEqual(['']);
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('A15 an account switch while the source is being read: nothing adopted, no loading left, nothing written', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    const g = newGate();
    ctl.gate.set('modules', g);
    fireEvent.change(select, { target: { value: 'src-1' } });
    await waitFor(() => expect(g.arrived).toBe(true));
    signedInAs('u2');
    g.release();
    expect(await screen.findByText(/different account/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('First')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('A16 an account switch during the final ownership check at Create is refused, with no destination write', async () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    await adopt('src-1');
    const g = newGate();
    ctl.gate.set('courses', g);
    await createFromConfirm();
    await waitFor(() => expect(g.arrived).toBe(true));
    signedInAs('u2');
    g.release();
    expect(await screen.findByText(/different account/)).toBeInTheDocument();
    expect(finish).not.toHaveBeenCalled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('A17 the result handed to the builder page names the adopted source and account', async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={onFinish} />);
    toOutlineStep();
    await adopt('src-1');
    await createFromConfirm();
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(onFinish.mock.calls[0][0].copySource).toEqual({ courseId: 'src-1', actorId: 'u1' });
  });

  it('A18 AI -> copy while an AI draft is pending: the copy can be adopted and created, and the late draft changes nothing', async () => {
    let releaseAi!: (v: any) => void;
    (mockSupabaseClient.functions.invoke as any).mockReturnValue(new Promise((r) => (releaseAi = r)));
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    fireEvent.change(screen.getByPlaceholderText(/Add a strong course description/), { target: { value: 'A long enough description' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate outline/ }));
    await adopt('src-1'); // Continue becomes enabled while the AI request is still pending
    await createFromConfirm();
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
    await act(async () => releaseAi({ data: { sections: [{ title: 'AI section', lessons: [] }] }, error: null }));
    await flush();
    expect(finish.mock.calls[0][0].outline.map((s: any) => s.title)).toEqual(['First', 'Second']);
    await waitFor(() => expect(createdItems().map((i) => i.title)).toEqual(['One', 'Two', 'Essay']));
  });

  it('A19 a superseded AI request finishing late does not clear the busy state of the newer AI request', async () => {
    const releases: ((v: any) => void)[] = [];
    (mockSupabaseClient.functions.invoke as any).mockImplementation(() => new Promise((r) => releases.push(r)));
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    fireEvent.change(screen.getByPlaceholderText(/Add a strong course description/), { target: { value: 'A long enough description' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate outline/ }));
    await openCopy();
    fireEvent.click(screen.getByText('Generate with AI'));
    fireEvent.click(screen.getByRole('button', { name: /Generate outline/ }));
    expect(releases).toHaveLength(2);
    await act(async () => releases[0]({ data: { sections: [{ title: 'Old AI', lessons: [] }] }, error: null }));
    await flush();
    expect(screen.getByRole('button', { name: /Generate outline/ })).toBeDisabled();
    expect(screen.queryByDisplayValue('Old AI')).not.toBeInTheDocument();
    await act(async () => releases[1]({ data: { sections: [{ title: 'New AI', lessons: [] }] }, error: null }));
    await flush();
    expect(screen.getByDisplayValue('New AI')).toBeInTheDocument();
  });
});

describe('T-18 r2 reads fail closed: errors, empty source, limits and incomplete replies', () => {
  it.each([
    ['ownership check', () => (ctl.failOwnership = 'ownership read failed'), /could not be checked/],
    ['sections', () => ctl.failMany.set('modules', 'modules read failed'), /sections could not be read/],
    ['lessons', () => ctl.failMany.set('content_items', 'items read failed'), /lessons could not be read/],
  ])('R1 a %s read error is shown, no outline is adopted and nothing can be created', async (_n, arm, msg) => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    arm();
    fireEvent.change(select, { target: { value: 'src-1' } });
    expect(await screen.findByText(msg)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('First')).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('R2 an empty source (no sections) is refused in the wizard and nothing can be created', async () => {
    db.tables.courses.set('empty', { id: 'empty', title: 'Empty course', instructor_id: 'u1' });
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    fireEvent.change(select, { target: { value: 'empty' } });
    expect(await screen.findByText('That course has no sections to copy.')).toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
    expect(finish).not.toHaveBeenCalled();
  });

  it('R3 a course I do not own is refused by the reader before its sections are read', async () => {
    await expect(loadCourseOutline(reader, 'other', 'u1')).rejects.toThrow('That course is not one of your courses');
    expect(ctl.reads).not.toContain('modules');
  });

  it('R4 more sections than the explicit limit is refused, not truncated', async () => {
    for (let i = 0; i <= COPY_LIMITS.modules; i++) db.tables.modules.set(`big${i}`, { id: `big${i}`, course_id: 'src-1', title: `S${i}`, position: i + 2 });
    await expect(loadCourseOutline(reader, 'src-1', 'u1')).rejects.toThrow(`more than ${COPY_LIMITS.modules}`);
  });

  it('R5 a reply shortened by a server row cap is refused as incomplete', async () => {
    ctl.cap = 2;
    await expect(loadCourseOutline(reader, 'src-1', 'u1')).rejects.toThrow('could not be read completely');
  });

  it('R6 a reply without an exact count is refused as incomplete', async () => {
    ctl.noCount.add('content_items');
    await expect(loadCourseOutline(reader, 'src-1', 'u1')).rejects.toThrow(CopyReadError);
    ctl.noCount = new Set(['courses']);
    await expect(listCopyableCourses(reader, 'u1')).rejects.toThrow('could not be read completely');
  });
});

// Credential-shaped samples are assembled from parts so no literal in this file looks like a real secret.
const J = (...p: string[]) => p.join('');
const jwt = J('ey', 'JhbGciOiJIUzI1NiJ9', '.', 'ey', 'JzdWIiOiJ0ZXN0LW9ubHkifQ', '.', 'dGVzdC1vbmx5LXNpZw');
// r4: forms URL parsing reads as a credential although the text as written does not spell one.
const CONTROL_NEGATIVE: [string, string][] = [
  ['tab entity inside a query key', J("<a href='https://example.test/?to&#9;", "ken=SECRETMARK'>x</a>")],
  ['nested tab entity inside a query key', J("<a href='https://example.test/?to&amp;#9;", "ken=SECRETMARK'>x</a>")],
  ['line feed entity inside a relative query key', J("<a href='/a?to&#10;", "ken=SECRETMARK'>x</a>")],
  ['nested line feed entity inside a relative query key', J("<a href='/a?to&amp;#10;", "ken=SECRETMARK'>x</a>")],
  ['carriage return entity inside a query key', J("<a href='/a?to&#13;", "ken=SECRETMARK'>x</a>")],
  ['literal tab inside a query key', J("<a href='/a?to\t", "ken=SECRETMARK'>x</a>")],
  ['literal line feed inside a query key', J("<a href='/a?to\n", "ken=SECRETMARK'>x</a>")],
  ['backslash user and password', J('<a href="https:\\\\', 'user', ':', 'SECRETMARK', '@example.test/a">x</a>')],
  ['mixed backslash and slash user and password', J('<a href="https:\\/', 'user', ':', 'SECRETMARK', '@example.test/a">x</a>')],
  ['other control character inside a link', '<a href="/a?x&#1;=1">x</a>'],
];
const NEGATIVE: [string, string][] = [
  ['signed storage link', J('<a href="https://proj.example.co/storage/v1/object/', 'sign', '/course-materials/a.pdf?t', 'oken=', 'abc">x</a>')],
  ['signed storage path without query', J('https://proj.example.co/storage/v1/object/', 'sign', '/b/a.pdf')],
  ['presigned object link', J('<img src="https://bucket.example.com/a.png?X-Amz-Algorithm=A&amp;X-Amz-', 'Credential', '=EXAMPLE&amp;X-Amz-', 'Signature', '=00">')],
  ['user and password in a link', J('https://', 'admin', ':', 'pw', '@files.example.com/a')],
  ['access token after an encoded ampersand', J('<a href="https://api.example.com/v1?a=1&amp;access_', 'token=abc">x</a>')],
  ['token in the fragment', J('https://app.example.com/cb#access_', 'token=abc&state=1')],
  ['bare signed token in text', `<p>Use ${jwt} to sign in</p>`],
  ['api key on an embed', J('<iframe src="https://maps.example.com/embed?', 'key', '=EXAMPLE&q=x"></iframe>')],
  ['mixed-case signature key', J('//cdn.example.com/v.mp4?Si', 'g=00&se=2030')],
  ['relative signed storage link', J('<a href="/storage/v1/object/', 'sign', '/b/a.pdf?t', 'oken=abc">x</a>')],
  ['relative link with an access token', J('<a href="/files/a.pdf?access_', 'token=abc">x</a>')],
  ['query-only relative link with a signature', J('<a href="?s', 'ig=00">x</a>')],
  ['entity-obfuscated user and password', J('<a href="https:&#47;&#47;', 'admin', ':', 'pw', '&#64;files.example.com/a">x</a>')],
  ['hex-entity signed path', J('<a href="&#x2F;storage&#x2F;v1&#x2F;object&#x2F;', 'sign', '&#x2F;b&#x2F;a.pdf">x</a>')],
  ['named-entity token query', J('<a href="/a.pdf&quest;t', 'oken&equals;abc">x</a>')],
  ['nested entity token query', J('<a href="/a.pdf&amp;#63;t', 'oken=abc">x</a>')],
  ['percent-encoded token query', J('<a href="/a.pdf%3Ft', 'oken%3Dabc">x</a>')],
  ['unsupported named entity in a link', '<a href="https&bogus;//files.example.com/a">x</a>'],
  ['encoding nested too deep to check', '<a href="/a&amp;amp;amp;amp;amp;#63;x=1">x</a>'],
  ...CONTROL_NEGATIVE,
];
const POSITIVE: [string, string][] = [
  ['public storage object', '<img src="https://proj.example.co/storage/v1/object/public/course-materials/a.png">'],
  ['video with start time', '<a href="https://www.youtube.com/watch?v=abc123&amp;t=30">video</a>'],
  ['page link with anchor', '<a href="https://docs.example.org/guide?page=2#intro">guide</a>'],
  ['relative course link', '<a href="/courses/1/modules">modules</a>'],
  ['the word token in prose', '<p>A token economy rewards students. Your password is never shown.</p>'],
  ['rich text', '<h2>Intro</h2><ul><li><strong>Bold</strong> and <em>em</em></li></ul>'],
  ['plain text', 'Read chapter 2 before class.'],
  ['relative link with an ordinary query', '<a href="/courses/1/modules?tab=2&amp;page=3#top">modules</a>'],
  ['typographic entities', '<p>Week&nbsp;1 &mdash; &ldquo;Intro&rdquo; &copy; 2026&hellip;</p>'],
  ['ampersand and percent in prose', '<p>Q&A session: 50% of the grade, R&D notes.</p>'],
  ['numeric entities in an ordinary link', '<a href="https:&#47;&#47;docs.example.org&#47;guide">guide</a>'],
  ['rich text with literal newlines and tabs between tags', '<ul>\n\t<li><a href="/courses/1?tab=2">One</a></li>\n\t<li>Two</li>\n</ul>'],
  ['a tab entity in ordinary text', '<p>Name:&#9;value</p>'],
  ['a Windows path in prose', '<p>Save it to C:\\Users\\me\\notes.txt</p>'],
  ['a backslash in an ordinary public link', '<a href="https://docs.example.org/a\\b">doc</a>'],
];

describe('T-18 r2 B: credential-bearing lesson text fails closed; ordinary text copies unchanged', () => {
  it.each(NEGATIVE)('B1 refuses %s', (_n, text) => {
    expect(hasCredentialReference(text)).toBe(true);
  });

  it.each(POSITIVE)('B2 allows %s', (_n, text) => {
    expect(hasCredentialReference(text)).toBe(false);
  });

  it('B3 the reader refuses the whole copy and names the lesson, without repeating the credential', async () => {
    db.tables.content_items.get('i3').content = `<p>Key: ${jwt}</p>`;
    const err = await loadCourseOutline(reader, 'src-1', 'u1').catch((e) => e);
    expect(err).toBeInstanceOf(CopyUnsupportedContentError);
    expect(err.lessons).toEqual(['section 2, lesson 1']);
    expect(err.message).not.toContain(jwt);
    expect(err.message).not.toContain('Essay');
  });

  it('B4 in the wizard, a credential-bearing source shows the refusal, adopts nothing and cannot be created', async () => {
    db.tables.content_items.get('i1').content = NEGATIVE[0][1];
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    fireEvent.change(select, { target: { value: 'src-1' } });
    expect(await screen.findByText(/sign-in key, password or signed access token/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('First')).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('B6 an entity-obfuscated credential under a sensitive title: no adopt, no write, and neither the title nor the link is shown', async () => {
    const title = J('Private ', 'TITLEMARK', ' lesson');
    const link = NEGATIVE.find(([n]) => n === 'entity-obfuscated user and password')![1];
    Object.assign(db.tables.content_items.get('i2'), { title, content: link });
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    fireEvent.change(select, { target: { value: 'src-1' } });
    const alert = await screen.findByText(/section 1, lesson 2/);
    expect(alert.textContent).not.toContain('TITLEMARK');
    expect(alert.textContent).not.toContain('files.example.com');
    expect(screen.queryByDisplayValue(title)).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it.each(CONTROL_NEGATIVE)('B7 in the wizard, %s: no adopt, no write, and neither the title nor the link is shown', async (_n, link) => {
    const title = J('Private ', 'TITLEMARK', ' lesson');
    Object.assign(db.tables.content_items.get('i2'), { title, content: link });
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={finish} />);
    toOutlineStep();
    const select = await openCopy();
    fireEvent.change(select, { target: { value: 'src-1' } });
    const alert = await screen.findByText(/section 1, lesson 2/);
    expect(alert.textContent).not.toContain('TITLEMARK');
    expect(alert.textContent).not.toContain('SECRETMARK');
    expect(alert.textContent).not.toContain('example.test');
    expect(screen.queryByDisplayValue(title)).not.toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
    expect(courseCount()).toBe(SEEDED_COURSES);
  });

  it('B5 ordinary rich text with authorized links is copied byte for byte', async () => {
    const rich = POSITIVE.map(([, t]) => t).join('\n');
    db.tables.content_items.get('i1').content = rich;
    const sections = await loadCourseOutline(reader, 'src-1', 'u1');
    expect(sections[0].lessons[0].content).toBe(rich);
  });
});
