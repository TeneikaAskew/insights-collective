// ABOUTME: Course-scoped learner roster for the instructor builder's Students tab.
// ABOUTME: Progress comes from content_item_progressions over published lessons (never enrollments.completion_status).

import { supabase } from '@/integrations/supabase/client';
import { DONE_PROGRESSION_STATES, isProgressionDone } from '@/utils/progressionStates';

export interface RosterLearner {
  userId: string;
  name: string;
  avatarUrl: string | null;
  enrolledAt: string | null;
  /**
   * Display only: rounded percent of the course's published lessons finished (0-100),
   * by the same rule as useCourseProgress. null means unknown: the course has no
   * published lessons, so there is nothing to measure against. Never a fake 0.
   * Decisions (finished, not started, averages) use completedItems/totalItems.
   */
  progress: number | null;
  completedItems: number;
  totalItems: number;
  needsAttention: boolean;
}

export interface RosterModule { id: string; title: string; position: number | null }
export interface RosterItem { id: string; module_id: string | null; type: string; title: string | null }
export interface RosterProgression { user_id: string; content_item_id: string; workflow_state: string | null }

export interface RosterData {
  learners: RosterLearner[];
  modules: RosterModule[];
  items: RosterItem[];
  progressions: RosterProgression[];
}

export type RosterSort = 'enrolled_desc' | 'enrolled_asc' | 'progress_desc' | 'progress_asc' | 'name_asc';

/** Learners with no progress this many days after enrolling are flagged. */
export const NOT_STARTED_DAYS = 7;

/** Rows per request. Must not exceed the PostgREST max-rows cap, or pages are silently short. */
export const PAGE_SIZE = 1000;

/** Ids per `in` filter, so request URLs stay bounded for large courses. */
export const ID_CHUNK = 200;

type Counts = { completedItems: number; totalItems: number };

/**
 * Exact unrounded share of published lessons finished (0-1), or null when the
 * course has no published lessons. Decisions use this, never the rounded percent.
 */
export function progressShare({ completedItems, totalItems }: Counts): number | null {
  return totalItems > 0 ? completedItems / totalItems : null;
}

/** Finished every published lesson, by exact count (199/200 is not finished). */
export function isComplete({ completedItems, totalItems }: Counts): boolean {
  return totalItems > 0 && completedItems >= totalItems;
}

/**
 * Enrolled at least NOT_STARTED_DAYS ago and finished no lesson at all, by exact
 * count (1/201 has started even though it rounds to 0%). Unknown is never flagged.
 */
export function isNotStarted(counts: Counts, enrolledAt: string | null, now: Date = new Date()): boolean {
  if (counts.totalItems === 0 || counts.completedItems > 0 || !enrolledAt) return false;
  const ageMs = now.getTime() - new Date(enrolledAt).getTime();
  return ageMs >= NOT_STARTED_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Per-learner progress from progression evidence. Only done states on this
 * course's published items count; rows for other courses or other users are ignored.
 */
export function computeLearnerProgress(
  userIds: string[],
  itemIds: string[],
  progressions: RosterProgression[],
): Map<string, { completedItems: number; totalItems: number; progress: number | null }> {
  const items = new Set(itemIds);
  const users = new Set(userIds);
  const done = new Map<string, Set<string>>();
  for (const p of progressions) {
    if (!users.has(p.user_id) || !items.has(p.content_item_id) || !isProgressionDone(p.workflow_state)) continue;
    let s = done.get(p.user_id);
    if (!s) done.set(p.user_id, (s = new Set()));
    s.add(p.content_item_id);
  }
  const totalItems = items.size;
  const out = new Map<string, { completedItems: number; totalItems: number; progress: number | null }>();
  for (const id of userIds) {
    const completedItems = done.get(id)?.size ?? 0;
    out.set(id, {
      completedItems,
      totalItems,
      progress: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : null,
    });
  }
  return out;
}

type Res<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Reads every page, in a stable order the caller sets, until a page comes back
 * shorter than PAGE_SIZE. Throws on any page's error, including the last.
 * Limit: a server cap below PAGE_SIZE would end paging early and is not detected.
 */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Res<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return rows;
  }
}

/** Splits ids into ID_CHUNK-sized `in` lists and pages each one. Chunks run in order. */
async function fetchAllByIds<T>(
  ids: string[],
  page: (chunk: string[], from: number, to: number) => PromiseLike<Res<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    rows.push(...(await fetchAll<T>((from, to) => page(chunk, from, to))));
  }
  return rows;
}

/**
 * Loads the roster plus the published lessons and progression rows it was
 * computed from, so the Reports tab reuses exactly the same inputs.
 *
 * Access is decided by the database: enrollments_staff_select and the
 * instructor progression policy allow admins and the course's instructors only,
 * so another instructor gets zero rows, never someone else's learners.
 * Throws on any query error so the UI can show a retry instead of zeros.
 */
export async function fetchCourseRosterData(courseId: string, now: Date = new Date()): Promise<RosterData> {
  const enrollments = await fetchAll<{ user_id: string | null; enrolled_at: string | null }>((from, to) =>
    supabase
      .from('enrollments')
      .select('user_id, enrolled_at')
      .eq('course_id', courseId)
      .order('user_id')
      .range(from, to),
  );

  // Same scope as useCourseProgress: published items inside published modules.
  const modules = await fetchAll<RosterModule>((from, to) =>
    supabase
      .from('modules')
      .select('id, title, position')
      .eq('course_id', courseId)
      .eq('published', true)
      .order('id')
      .range(from, to),
  );
  const moduleIds = modules.map((m) => m.id);
  const items = await fetchAllByIds<RosterItem>(moduleIds, (chunk, from, to) =>
    supabase
      .from('content_items')
      .select('id, module_id, type, title')
      .in('module_id', chunk)
      .eq('published', true)
      .order('id')
      .range(from, to),
  );

  const rows = enrollments.filter((e) => e.user_id) as Array<{ user_id: string; enrolled_at: string | null }>;
  if (rows.length === 0) return { learners: [], modules, items, progressions: [] };

  const ids = rows.map((e) => e.user_id);
  const itemIds = items.map((i) => i.id);

  const [profiles, progressions] = await Promise.all([
    fetchAllByIds<{ id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>(
      ids,
      (chunk, from, to) =>
        supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', chunk)
          .order('id')
          .range(from, to),
    ),
    fetchAllByIds<RosterProgression>(itemIds, (chunk, from, to) =>
      supabase
        .from('content_item_progressions')
        .select('user_id, content_item_id, workflow_state')
        .in('content_item_id', chunk)
        .in('workflow_state', [...DONE_PROGRESSION_STATES])
        .order('user_id')
        .order('content_item_id')
        .range(from, to),
    ),
  ]);

  const byId = new Map(profiles.map((p) => [p.id, p]));
  const progressByUser = computeLearnerProgress(ids, itemIds, progressions);
  const learners = rows.map((e) => {
    const p = byId.get(e.user_id);
    const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '';
    const pr = progressByUser.get(e.user_id) ?? { completedItems: 0, totalItems: itemIds.length, progress: null };
    return {
      userId: e.user_id,
      name: name || 'Unnamed learner',
      avatarUrl: p?.avatar_url ?? null,
      enrolledAt: e.enrolled_at ?? null,
      ...pr,
      needsAttention: isNotStarted(pr, e.enrolled_at ?? null, now),
    };
  });
  return { learners, modules, items, progressions };
}

export async function fetchCourseRoster(courseId: string, now: Date = new Date()): Promise<RosterLearner[]> {
  return (await fetchCourseRosterData(courseId, now)).learners;
}

/**
 * Mean of exact per-learner shares over learners whose progress is known,
 * rounded once for display; null when none is known. Averaging rounded
 * percents would drift (0/6 and 1/6 give 9% instead of the exact 8%).
 */
export function averageProgress(learners: Counts[]): number | null {
  const shares = learners.map(progressShare).filter((x): x is number => x !== null);
  return shares.length ? Math.round((shares.reduce((a, b) => a + b, 0) / shares.length) * 100) : null;
}

export function filterAndSortRoster(
  learners: RosterLearner[],
  query: string,
  sort: RosterSort,
  attentionOnly = false,
): RosterLearner[] {
  const q = query.trim().toLowerCase();
  const time = (d: string | null) => (d ? new Date(d).getTime() : 0);
  const list = learners.filter(
    (l) => (!q || l.name.toLowerCase().includes(q)) && (!attentionOnly || l.needsAttention),
  );
  // Exact share order; unknown progress sorts last in both directions.
  const byProgress = (dir: 1 | -1) => (a: RosterLearner, b: RosterLearner) => {
    const x = progressShare(a);
    const y = progressShare(b);
    if (x === null || y === null) return (x === null ? 1 : 0) - (y === null ? 1 : 0);
    return (x - y) * dir;
  };
  const cmp: Record<RosterSort, (a: RosterLearner, b: RosterLearner) => number> = {
    enrolled_desc: (a, b) => time(b.enrolledAt) - time(a.enrolledAt),
    enrolled_asc: (a, b) => time(a.enrolledAt) - time(b.enrolledAt),
    progress_desc: byProgress(-1),
    progress_asc: byProgress(1),
    name_asc: (a, b) => a.name.localeCompare(b.name),
  };
  return [...list].sort(cmp[sort]);
}
