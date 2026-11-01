// ABOUTME: T-10 read-model oracle for useCourseProgress against a filter-aware Supabase fake.
// ABOUTME: Eligible universe, DONE set, exact completion, display cap, stale responses and key resets.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCourseProgress, displayPercent } from '../useCourseProgress';

// --- Filter-aware Supabase fake ---------------------------------------------
// Rows live per table. eq/in filters are APPLIED to the rows (eq uses strict
// equality, so `published: null` never matches `true`, like SQL). A row is
// only excluded if the hook actually asked for the filter.
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};
const tableErrors: Record<string, string> = {};
const gates: Array<{ table: string; courseId?: string; release: Promise<void> }> = [];
const calls: Array<{ table: string; filters: Array<[string, string, any]> }> = [];

function buildQuery(table: string) {
  const filters: Array<[string, string, any]> = [];
  const self: any = {
    select: () => self,
    eq: (col: string, val: any) => {
      filters.push(['eq', col, val]);
      return self;
    },
    in: (col: string, vals: any[]) => {
      filters.push(['in', col, vals]);
      return self;
    },
    then: (resolve: (v: any) => void, reject?: (e: any) => void) => {
      calls.push({ table, filters: [...filters] });
      const courseId = filters.find(([op, col]) => op === 'eq' && col === 'course_id')?.[2];
      const gate = gates.find((g) => g.table === table && (g.courseId === undefined || g.courseId === courseId));
      const respond = () => {
        if (tableErrors[table]) {
          resolve({ data: null, error: { message: tableErrors[table] } });
          return;
        }
        const rows = (tables[table] ?? []).filter((row) =>
          filters.every(([op, col, val]) => (op === 'eq' ? row[col] === val : (val as any[]).includes(row[col]))),
        );
        resolve({ data: rows, error: null });
      };
      if (gate) gate.release.then(respond, reject);
      else respond();
    },
  };
  return self;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (table: string) => buildQuery(table) },
}));

const markContentItemAsRead = vi.fn();
vi.mock('@/services/canvasContentService', () => ({
  default: { markContentItemAsRead: (...a: any[]) => markContentItemAsRead(...a) },
}));

let authUserId: string | undefined = 'user-1';
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUserId ? { id: authUserId } : null }),
}));

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({ log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

const COURSE_A = '11111111-2222-4333-8444-555555555555';
const COURSE_B = '22222222-3333-4444-8555-666666666666';

function gate(table: string, courseId?: string) {
  let release!: () => void;
  const p = new Promise<void>((r) => (release = r));
  gates.push({ table, courseId, release: p });
  return release;
}

/** Six eligible items in two published modules, plus draft/null items and a draft/null module. */
function seedSixItemCourse(progressions: Row[]) {
  tables.modules = [
    { id: 'm1', course_id: COURSE_A, published: true },
    { id: 'm2', course_id: COURSE_A, published: true },
    { id: 'mDraft', course_id: COURSE_A, published: false },
    { id: 'mNull', course_id: COURSE_A, published: null },
  ];
  tables.content_items = [
    { id: 'i1', module_id: 'm1', published: true },
    { id: 'i2', module_id: 'm1', published: true },
    { id: 'i3', module_id: 'm1', published: true },
    { id: 'q4', module_id: 'm2', published: true },
    { id: 'i5', module_id: 'm2', published: true },
    { id: 'i6', module_id: 'm2', published: true },
    { id: 'iDraft', module_id: 'm1', published: false },
    { id: 'iNull', module_id: 'm2', published: null },
    { id: 'iInDraftModule', module_id: 'mDraft', published: true },
    { id: 'iInNullModule', module_id: 'mNull', published: true },
  ];
  tables.content_item_progressions = progressions.map((p) => ({ user_id: 'user-1', ...p }));
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  for (const k of Object.keys(tableErrors)) delete tableErrors[k];
  gates.splice(0);
  calls.splice(0);
  markContentItemAsRead.mockReset();
  authUserId = 'user-1';
});

describe('displayPercent (display-only cap)', () => {
  it('is 0 for an empty universe and never NaN', () => {
    expect(displayPercent(0, 0)).toBe(0);
    expect(Number.isNaN(displayPercent(0, 0))).toBe(false);
  });
  it('caps an incomplete course at 99 and shows 100 only when every item is done', () => {
    expect(displayPercent(249, 250)).toBe(99); // round() alone would say 100
    expect(displayPercent(250, 250)).toBe(100);
    expect(displayPercent(2, 6)).toBe(33);
    expect(displayPercent(3, 6)).toBe(50);
    expect(displayPercent(0, 6)).toBe(0);
  });
});

describe('useCourseProgress read model (T-10)', () => {
  it('six eligible items: excludes draft/null items and modules, counts read and graded, 33%', async () => {
    seedSixItemCourse([
      { content_item_id: 'i1', workflow_state: 'read' },
      { content_item_id: 'i2', workflow_state: 'graded' },
      { content_item_id: 'i3', workflow_state: 'unread' },
      { content_item_id: 'q4', workflow_state: 'started' },
      // Done progressions on ineligible items must never count.
      { content_item_id: 'iDraft', workflow_state: 'completed' },
      { content_item_id: 'iNull', workflow_state: 'read' },
      { content_item_id: 'iInDraftModule', workflow_state: 'read' },
      { content_item_id: 'iInNullModule', workflow_state: 'read' },
    ]);
    const { result } = renderHook(() => useCourseProgress(COURSE_A));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const d = result.current.data!;
    expect(d.eligibleItemIds.slice().sort()).toEqual(['i1', 'i2', 'i3', 'i5', 'i6', 'q4']);
    expect(d.doneItemIds.slice().sort()).toEqual(['i1', 'i2']);
    expect(d.totalItems).toBe(6);
    expect(d.completedItems).toBe(2);
    expect(d.percent).toBe(33);
    expect(d.isComplete).toBe(false);
    expect(d.modules.map((m) => m.moduleId).sort()).toEqual(['m1', 'm2']);
    expect(d.modules.find((m) => m.moduleId === 'm1')).toEqual({
      moduleId: 'm1', totalItems: 3, completedItems: 2, percent: 67, isComplete: false,
    });
    expect(d.modules.find((m) => m.moduleId === 'm2')).toEqual({
      moduleId: 'm2', totalItems: 3, completedItems: 0, percent: 0, isComplete: false,
    });
    // The exclusion comes from the hook's own published filters, not from fixture luck.
    expect(calls.find((c) => c.table === 'modules')!.filters).toContainEqual(['eq', 'published', true]);
    expect(calls.find((c) => c.table === 'content_items')!.filters).toContainEqual(['eq', 'published', true]);
  });

  it('a permitted completion with readback moves 2/6 (33%) to 3/6 (50%)', async () => {
    seedSixItemCourse([
      { content_item_id: 'i1', workflow_state: 'read' },
      { content_item_id: 'i2', workflow_state: 'graded' },
    ]);
    markContentItemAsRead.mockImplementation(async (id: string) => {
      tables.content_item_progressions.push({ user_id: 'user-1', content_item_id: id, workflow_state: 'read' });
    });
    const { result } = renderHook(() => useCourseProgress(COURSE_A));
    await waitFor(() => expect(result.current.data?.percent).toBe(33));

    await act(async () => {
      await result.current.markItemComplete('i3');
    });
    expect(markContentItemAsRead).toHaveBeenCalledTimes(1);
    expect(markContentItemAsRead).toHaveBeenCalledWith('i3');
    expect(result.current.data!.completedItems).toBe(3);
    expect(result.current.data!.percent).toBe(50);
  });

  it('a refused write leaves the stored 33% unchanged and surfaces nothing as done', async () => {
    seedSixItemCourse([
      { content_item_id: 'i1', workflow_state: 'read' },
      { content_item_id: 'i2', workflow_state: 'graded' },
    ]);
    markContentItemAsRead.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useCourseProgress(COURSE_A));
    await waitFor(() => expect(result.current.data?.percent).toBe(33));

    await act(async () => {
      await expect(result.current.markItemComplete('q4')).rejects.toThrow('denied');
    });
    expect(result.current.data!.percent).toBe(33);
    expect(result.current.data!.doneItemIds).not.toContain('q4');
  });

  it('deduplicates repeated item rows and duplicate progressions', async () => {
    tables.modules = [{ id: 'm1', course_id: COURSE_A, published: true }];
    tables.content_items = [
      { id: 'i1', module_id: 'm1', published: true },
      { id: 'i1', module_id: 'm1', published: true },
      { id: 'i2', module_id: 'm1', published: true },
    ];
    tables.content_item_progressions = [
      { user_id: 'user-1', content_item_id: 'i1', workflow_state: 'read' },
      { user_id: 'user-1', content_item_id: 'i1', workflow_state: 'completed' },
    ];
    const { result } = renderHook(() => useCourseProgress(COURSE_A));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data!.totalItems).toBe(2);
    expect(result.current.data!.completedItems).toBe(1);
    expect(result.current.data!.percent).toBe(50);
    expect(result.current.data!.modules[0]).toEqual({
      moduleId: 'm1', totalItems: 2, completedItems: 1, percent: 50, isComplete: false,
    });
  });

  it('empty: published modules with no published items give 0 of 0, not complete', async () => {
    tables.modules = [{ id: 'm1', course_id: COURSE_A, published: true }];
    tables.content_items = [{ id: 'iDraft', module_id: 'm1', published: false }];
    const { result } = renderHook(() => useCourseProgress(COURSE_A));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const d = result.current.data!;
    expect(d.totalItems).toBe(0);
    expect(d.completedItems).toBe(0);
    expect(d.percent).toBe(0);
    expect(d.isComplete).toBe(false);
    expect(d.modules).toEqual([{ moduleId: 'm1', totalItems: 0, completedItems: 0, percent: 0, isComplete: false }]);
  });

  it('known 0: a non-empty course with nothing done is a legitimate 0%, distinct from unknown', async () => {
    seedSixItemCourse([]);
    const { result } = renderHook(() => useCourseProgress(COURSE_A));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeDefined();
    expect(result.current.data!.percent).toBe(0);
    expect(result.current.data!.totalItems).toBe(6);
  });

  it('near-100: 249 of 250 shows 99 and is not complete; 250 of 250 shows 100 and is complete', async () => {
    tables.modules = [{ id: 'm1', course_id: COURSE_A, published: true }];
    tables.content_items = Array.from({ length: 250 }, (_, n) => ({ id: `i${n}`, module_id: 'm1', published: true }));
    tables.content_item_progressions = Array.from({ length: 249 }, (_, n) => ({
      user_id: 'user-1', content_item_id: `i${n}`, workflow_state: 'read',
    }));
    const { result } = renderHook(() => useCourseProgress(COURSE_A));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data!.completedItems).toBe(249);
    expect(result.current.data!.percent).toBe(99);
    expect(result.current.data!.isComplete).toBe(false);
    expect(result.current.data!.modules[0].percent).toBe(99);
    expect(result.current.data!.modules[0].isComplete).toBe(false);

    tables.content_item_progressions.push({ user_id: 'user-1', content_item_id: 'i249', workflow_state: 'graded' });
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data!.percent).toBe(100);
    expect(result.current.data!.isComplete).toBe(true);
    expect(result.current.data!.modules[0].isComplete).toBe(true);
  });

  it('loading is unknown: data stays undefined until the response arrives', async () => {
    seedSixItemCourse([{ content_item_id: 'i1', workflow_state: 'read' }]);
    const release = gate('modules');
    const { result } = renderHook(() => useCourseProgress(COURSE_A));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    await act(async () => {
      release();
    });
    await waitFor(() => expect(result.current.data?.completedItems).toBe(1));
  });

  it('error is unknown: data is undefined, never a zeroed or stale number', async () => {
    seedSixItemCourse([{ content_item_id: 'i1', workflow_state: 'read' }]);
    const { result } = renderHook(() => useCourseProgress(COURSE_A));
    await waitFor(() => expect(result.current.data?.completedItems).toBe(1));

    tableErrors.content_item_progressions = 'progress fetch failed';
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.error).toBe('progress fetch failed');
    expect(result.current.data).toBeUndefined();
  });

  it('ignores a stale response for the previous course after the course changes', async () => {
    seedSixItemCourse([{ content_item_id: 'i1', workflow_state: 'read' }]);
    tables.modules.push({ id: 'mB', course_id: COURSE_B, published: true });
    tables.content_items.push(
      { id: 'b1', module_id: 'mB', published: true },
      { id: 'b2', module_id: 'mB', published: true },
    );
    tables.content_item_progressions.push({ user_id: 'user-1', content_item_id: 'b1', workflow_state: 'read' });

    const releaseA = gate('modules', COURSE_A);
    const { result, rerender } = renderHook(({ id }) => useCourseProgress(id), { initialProps: { id: COURSE_A } });
    rerender({ id: COURSE_B });
    await waitFor(() => expect(result.current.data?.totalItems).toBe(2));
    expect(result.current.data!.percent).toBe(50);

    // Course A's late answer arrives after B's; it must not overwrite B.
    await act(async () => {
      releaseA();
      await Promise.resolve();
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.data!.totalItems).toBe(2);
    expect(result.current.data!.doneItemIds).toEqual(['b1']);
    expect(result.current.isLoading).toBe(false);
  });

  it('a course change resets to unknown instead of showing the previous course numbers', async () => {
    seedSixItemCourse([{ content_item_id: 'i1', workflow_state: 'read' }]);
    tables.modules.push({ id: 'mB', course_id: COURSE_B, published: true });
    tables.content_items.push({ id: 'b1', module_id: 'mB', published: true });

    const { result, rerender } = renderHook(({ id }) => useCourseProgress(id), { initialProps: { id: COURSE_A } });
    await waitFor(() => expect(result.current.data?.totalItems).toBe(6));

    const releaseB = gate('modules', COURSE_B);
    rerender({ id: COURSE_B });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.data).toBeUndefined();
    await act(async () => {
      releaseB();
    });
    await waitFor(() => expect(result.current.data?.totalItems).toBe(1));
  });

  it('a user change resets to unknown and reads the new user progressions only', async () => {
    seedSixItemCourse([{ content_item_id: 'i1', workflow_state: 'read' }]);
    tables.content_item_progressions.push({ user_id: 'user-2', content_item_id: 'i5', workflow_state: 'read' });
    tables.content_item_progressions.push({ user_id: 'user-2', content_item_id: 'i6', workflow_state: 'read' });

    const { result, rerender } = renderHook(() => useCourseProgress(COURSE_A));
    await waitFor(() => expect(result.current.data?.doneItemIds).toEqual(['i1']));

    const releaseProg = gate('content_item_progressions');
    authUserId = 'user-2';
    rerender();
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.data).toBeUndefined();
    await act(async () => {
      releaseProg();
    });
    await waitFor(() => expect(result.current.data?.doneItemIds.slice().sort()).toEqual(['i5', 'i6']));
  });
});
