// ABOUTME: T-15 causal tests: roster progress comes from content_item_progressions, not enrollments.completion_status.
// ABOUTME: Covers unknown vs 0, published-only scope, done states, other users/courses, paging past the row cap, errors.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeClient, makeFakeDb, type FakeDb } from './fakeRosterSupabase';

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => makeFakeClient(h.db).from(t) },
}));

import {
  averageProgress,
  computeLearnerProgress,
  fetchCourseRoster,
  filterAndSortRoster,
  ID_CHUNK,
  isComplete,
  isNotStarted,
  PAGE_SIZE,
} from '../courseRosterService';

const NOW = new Date('2026-03-20T00:00:00Z');

function seed() {
  return makeFakeDb({
    enrollments: [
      // completion_status is deliberately wrong: the app never writes it.
      { course_id: 'c1', user_id: 'u1', enrolled_at: '2026-01-01T00:00:00Z', completion_status: 0 },
      { course_id: 'c1', user_id: 'u2', enrolled_at: '2026-01-01T00:00:00Z', completion_status: 80 },
      { course_id: 'c1', user_id: 'u3', enrolled_at: '2026-01-01T00:00:00Z', completion_status: 0 },
      { course_id: 'c2', user_id: 'u9', enrolled_at: '2026-01-01T00:00:00Z', completion_status: 0 },
    ],
    profiles: [
      { id: 'u1', first_name: 'Ada', last_name: 'L', avatar_url: null },
      { id: 'u2', first_name: 'Grace', last_name: 'H', avatar_url: null },
      { id: 'u3', first_name: 'Alan', last_name: 'T', avatar_url: null },
    ],
    modules: [
      { id: 'm1', course_id: 'c1', title: 'One', position: 1, published: true },
      { id: 'm2', course_id: 'c1', title: 'Draft', position: 2, published: false },
    ],
    content_items: [
      { id: 'i1', module_id: 'm1', course_id: 'c1', type: 'page', title: 'a', published: true },
      { id: 'i2', module_id: 'm1', course_id: 'c1', type: 'page', title: 'b', published: true },
      { id: 'i3', module_id: 'm1', course_id: 'c1', type: 'page', title: 'unpub', published: false },
      { id: 'i4', module_id: 'm2', course_id: 'c1', type: 'page', title: 'in draft module', published: true },
    ],
    content_item_progressions: [
      { user_id: 'u1', content_item_id: 'i1', workflow_state: 'read' },
      { user_id: 'u1', content_item_id: 'i2', workflow_state: 'completed' },
      { user_id: 'u3', content_item_id: 'i1', workflow_state: 'started' },
      { user_id: 'u3', content_item_id: 'i3', workflow_state: 'read' },
      { user_id: 'u3', content_item_id: 'i4', workflow_state: 'read' },
      { user_id: 'u9', content_item_id: 'i1', workflow_state: 'read' },
    ],
  });
}

beforeEach(() => {
  h.db = seed();
});

const byId = async (courseId = 'c1') =>
  Object.fromEntries((await fetchCourseRoster(courseId, NOW)).map((l) => [l.userId, l]));

describe('fetchCourseRoster progress source (T-15)', () => {
  it('uses progression evidence even when completion_status says 0', async () => {
    const r = await byId();
    expect(r.u1.progress).toBe(100);
    expect(r.u1.completedItems).toBe(2);
    expect(r.u1.totalItems).toBe(2);
  });

  it('ignores a stale completion_status of 80 with no progression evidence', async () => {
    expect((await byId()).u2.progress).toBe(0);
  });

  it('counts only done states on published lessons in published modules', async () => {
    // u3: i1 is only started, i3 unpublished, i4 sits in a draft module.
    const r = await byId();
    expect(r.u3.progress).toBe(0);
    expect(r.u3.needsAttention).toBe(true);
  });

  it('reports unknown (null), not 0, when the course has no published lessons', async () => {
    h.db.tables.content_items = [];
    const r = await byId();
    expect(r.u1.progress).toBeNull();
    expect(r.u1.totalItems).toBe(0);
    expect(r.u1.needsAttention).toBe(false);
    expect(averageProgress(Object.values(r))).toBeNull();
  });

  it('reads every page so progress is not cut at the row cap', async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: `p${String(i).padStart(2, '0')}`, module_id: 'm1', course_id: 'c1', type: 'page', title: null, published: true,
    }));
    const users = Array.from({ length: 40 }, (_, i) => `x${String(i).padStart(2, '0')}`);
    h.db.tables.content_items = items;
    h.db.tables.enrollments = users.map((u) => ({ course_id: 'c1', user_id: u, enrolled_at: '2026-03-19T00:00:00Z' }));
    h.db.tables.profiles = [];
    // 1200 done rows: every learner finished every lesson.
    h.db.tables.content_item_progressions = users.flatMap((u) =>
      items.map((it) => ({ user_id: u, content_item_id: it.id, workflow_state: 'completed' })),
    );
    const learners = await fetchCourseRoster('c1', NOW);
    expect(learners).toHaveLength(40);
    expect(learners.every((l) => l.progress === 100)).toBe(true);
    const pages = h.db.calls.filter((c) => c.table === 'content_item_progressions');
    expect(pages.length).toBe(2);
    expect(pages[0].range).toEqual([0, PAGE_SIZE - 1]);
  });

  it('reads more than 1000 modules, items and profiles without truncating', async () => {
    const modules = Array.from({ length: 1001 }, (_, i) => ({ id: `m${String(i).padStart(4, '0')}`, course_id: 'c1', title: 'm', position: i, published: true }));
    // 1500 items across the modules; the learner finished exactly 1499.
    const items = Array.from({ length: 1500 }, (_, i) => ({
      id: `it${String(i).padStart(4, '0')}`, module_id: modules[i % 1001].id, type: 'page', title: null, published: true,
    }));
    const users = Array.from({ length: 1001 }, (_, i) => `v${String(i).padStart(4, '0')}`);
    h.db.tables.modules = modules;
    h.db.tables.content_items = items;
    h.db.tables.enrollments = users.map((u) => ({ course_id: 'c1', user_id: u, enrolled_at: '2026-01-01T00:00:00Z' }));
    h.db.tables.profiles = users.map((u) => ({ id: u, first_name: `N${u}`, last_name: '', avatar_url: null }));
    h.db.tables.content_item_progressions = items.slice(0, 1499).map((it) => ({ user_id: users[1000], content_item_id: it.id, workflow_state: 'read' }));
    const learners = await fetchCourseRoster('c1', NOW);
    expect(learners).toHaveLength(1001);
    const last = learners.find((l) => l.userId === users[1000])!;
    expect(last.name).toBe(`N${users[1000]}`);
    expect(last.totalItems).toBe(1500);
    expect(last.completedItems).toBe(1499);
    expect(isComplete(last)).toBe(false);
    expect(learners.every((l) => l.name !== 'Unnamed learner')).toBe(true);
    // Every `in` list is chunked.
    expect(Math.max(...h.db.calls.flatMap((c) => c.inSizes.filter((n) => n > 3)))).toBeLessThanOrEqual(ID_CHUNK);
  });

  it('requests one more page at an exact PAGE_SIZE boundary', async () => {
    h.db.tables.modules = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `m${String(i).padStart(4, '0')}`, course_id: 'c1', title: 'm', position: i, published: true }));
    await fetchCourseRoster('c1', NOW);
    const pages = h.db.calls.filter((c) => c.table === 'modules');
    expect(pages.map((c) => c.range)).toEqual([[0, PAGE_SIZE - 1], [PAGE_SIZE, 2 * PAGE_SIZE - 1]]);
  });

  it.each(['modules', 'content_items', 'profiles', 'content_item_progressions', 'enrollments'])(
    'throws when the final page of %s fails',
    async (table) => {
      // Make each table need two pages, then fail the second request to it.
      const n = PAGE_SIZE + 1;
      h.db.tables.modules = [{ id: 'm1', course_id: 'c1', title: 'One', position: 1, published: true }];
      h.db.tables.content_items = [{ id: 'i1', module_id: 'm1', type: 'page', title: 'a', published: true }];
      if (table === 'modules') h.db.tables.modules = Array.from({ length: n }, (_, i) => ({ id: `m${String(i).padStart(4, '0')}`, course_id: 'c1', title: 'm', position: i, published: true }));
      if (table === 'content_items') h.db.tables.content_items = Array.from({ length: n }, (_, i) => ({ id: `i${String(i).padStart(4, '0')}`, module_id: 'm1', type: 'page', title: null, published: true }));
      if (table === 'profiles') h.db.tables.profiles = Array.from({ length: n }, () => ({ id: 'u1', first_name: 'dup', last_name: '', avatar_url: null }));
      if (table === 'content_item_progressions') h.db.tables.content_item_progressions = Array.from({ length: n }, () => ({ user_id: 'u1', content_item_id: 'i1', workflow_state: 'read' }));
      if (table === 'enrollments') h.db.tables.enrollments = Array.from({ length: n }, (_, i) => ({ course_id: 'c1', user_id: `e${String(i).padStart(4, '0')}`, enrolled_at: null }));
      h.db.failWhen = (t, nth) => (t === table && nth === 1 ? `final page of ${t} failed` : undefined);
      await expect(fetchCourseRoster('c1', NOW)).rejects.toThrow(`final page of ${table} failed`);
    },
  );

  it('throws on a progression read error instead of showing zeros', async () => {
    h.db.failTables = { content_item_progressions: 'progress denied' };
    await expect(fetchCourseRoster('c1', NOW)).rejects.toThrow('progress denied');
  });

  it('returns no learners for a caller RLS hides the course from', async () => {
    h.db.visible = { enrollments: () => false, content_item_progressions: () => false };
    expect(await fetchCourseRoster('c1', NOW)).toEqual([]);
  });
});

describe('roster helpers', () => {
  it('computeLearnerProgress ignores other users and other items', () => {
    const m = computeLearnerProgress(['a'], ['i1', 'i2'], [
      { user_id: 'a', content_item_id: 'i1', workflow_state: 'graded' },
      { user_id: 'a', content_item_id: 'zz', workflow_state: 'read' },
      { user_id: 'b', content_item_id: 'i2', workflow_state: 'read' },
    ]);
    expect(m.get('a')).toEqual({ completedItems: 1, totalItems: 2, progress: 50 });
  });

  it('isNotStarted never flags unknown progress', () => {
    expect(isNotStarted({ completedItems: 0, totalItems: 0 }, '2020-01-01T00:00:00Z', NOW)).toBe(false);
    expect(isNotStarted({ completedItems: 0, totalItems: 3 }, '2020-01-01T00:00:00Z', NOW)).toBe(true);
  });

  it('decides finished and not-started from exact counts, not the rounded percent', () => {
    // 199/200 rounds to 100% but is not finished.
    const nearly = computeLearnerProgress(['a'], Array.from({ length: 200 }, (_, i) => `i${i}`),
      Array.from({ length: 199 }, (_, i) => ({ user_id: 'a', content_item_id: `i${i}`, workflow_state: 'read' }))).get('a')!;
    expect(nearly.progress).toBe(100);
    expect(isComplete(nearly)).toBe(false);
    // 1/201 rounds to 0% but has started.
    const barely = { completedItems: 1, totalItems: 201 };
    expect(Math.round((1 / 201) * 100)).toBe(0);
    expect(isNotStarted(barely, '2020-01-01T00:00:00Z', NOW)).toBe(false);
    expect(isComplete({ completedItems: 200, totalItems: 200 })).toBe(true);
  });

  it('averages exact shares: 0/6 and 1/6 is 8%, not the 9% of rounded percents', () => {
    expect(averageProgress([{ completedItems: 0, totalItems: 6 }, { completedItems: 1, totalItems: 6 }])).toBe(8);
    expect(averageProgress([{ completedItems: 0, totalItems: 0 }])).toBeNull();
  });

  it('sorts unknown progress last in both directions', () => {
    const L = (userId: string, completedItems: number, totalItems: number) => ({
      userId, name: userId, avatarUrl: null, enrolledAt: null, completedItems, totalItems,
      progress: totalItems ? Math.round((completedItems / totalItems) * 100) : null, needsAttention: false,
    });
    const list = [L('n', 0, 0), L('lo', 1, 10), L('hi', 9, 10)];
    expect(filterAndSortRoster(list, '', 'progress_desc').map((l) => l.userId)).toEqual(['hi', 'lo', 'n']);
    expect(filterAndSortRoster(list, '', 'progress_asc').map((l) => l.userId)).toEqual(['lo', 'hi', 'n']);
    expect(averageProgress(list)).toBe(50);
  });
});
