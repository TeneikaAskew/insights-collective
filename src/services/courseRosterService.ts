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
   * Percent of the course's published lessons this learner has finished (0-100),
   * by the same rule as useCourseProgress. null means unknown: the course has no
   * published lessons, so there is nothing to measure against. Never a fake 0.
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

export function isNotStarted(progress: number | null, enrolledAt: string | null, now: Date = new Date()): boolean {
  if (progress === null || progress > 0 || !enrolledAt) return false;
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

/** Reads every page so a large course is never silently cut at the row cap. Throws on any error. */
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

function must<T>(res: Res<T>): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
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
  const modules = must<RosterModule>(
    await supabase.from('modules').select('id, title, position').eq('course_id', courseId).eq('published', true),
  );
  const moduleIds = modules.map((m) => m.id);
  const items = moduleIds.length
    ? must<RosterItem>(
        await supabase
          .from('content_items')
          .select('id, module_id, type, title')
          .in('module_id', moduleIds)
          .eq('published', true),
      )
    : [];

  const rows = enrollments.filter((e) => e.user_id) as Array<{ user_id: string; enrolled_at: string | null }>;
  if (rows.length === 0) return { learners: [], modules, items, progressions: [] };

  const ids = rows.map((e) => e.user_id);
  const itemIds = items.map((i) => i.id);

  const [profiles, progressions] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', ids)
      .then((r) => must<{ id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>(r)),
    itemIds.length
      ? fetchAll<RosterProgression>((from, to) =>
          supabase
            .from('content_item_progressions')
            .select('user_id, content_item_id, workflow_state')
            .in('content_item_id', itemIds)
            .in('workflow_state', [...DONE_PROGRESSION_STATES])
            .order('user_id')
            .order('content_item_id')
            .range(from, to),
        )
      : Promise.resolve([] as RosterProgression[]),
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
      needsAttention: isNotStarted(pr.progress, e.enrolled_at ?? null, now),
    };
  });
  return { learners, modules, items, progressions };
}

export async function fetchCourseRoster(courseId: string, now: Date = new Date()): Promise<RosterLearner[]> {
  return (await fetchCourseRosterData(courseId, now)).learners;
}

/** Mean progress over learners whose progress is known; null when none is known. */
export function averageProgress(learners: RosterLearner[]): number | null {
  const known = learners.filter((l) => l.progress !== null) as Array<RosterLearner & { progress: number }>;
  return known.length ? Math.round(known.reduce((s, l) => s + l.progress, 0) / known.length) : null;
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
  // Unknown progress sorts last in both directions.
  const byProgress = (dir: 1 | -1) => (a: RosterLearner, b: RosterLearner) => {
    if (a.progress === null || b.progress === null) return (a.progress === null ? 1 : 0) - (b.progress === null ? 1 : 0);
    return (a.progress - b.progress) * dir;
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
