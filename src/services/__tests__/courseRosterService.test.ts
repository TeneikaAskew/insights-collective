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
    expect(isNotStarted(null, '2020-01-01T00:00:00Z', NOW)).toBe(false);
    expect(isNotStarted(0, '2020-01-01T00:00:00Z', NOW)).toBe(true);
  });

  it('sorts unknown progress last in both directions', () => {
    const L = (userId: string, progress: number | null) => ({
      userId, name: userId, avatarUrl: null, enrolledAt: null, progress, completedItems: 0, totalItems: 0, needsAttention: false,
    });
    const list = [L('n', null), L('lo', 10), L('hi', 90)];
    expect(filterAndSortRoster(list, '', 'progress_desc').map((l) => l.userId)).toEqual(['hi', 'lo', 'n']);
    expect(filterAndSortRoster(list, '', 'progress_asc').map((l) => l.userId)).toEqual(['lo', 'hi', 'n']);
    expect(averageProgress(list)).toBe(50);
  });
});
