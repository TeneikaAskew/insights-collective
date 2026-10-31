// ABOUTME: Course-scoped learner roster for the instructor builder's Students tab.
// ABOUTME: Reads enrollments + profiles under RLS (course instructor or admin only) plus pure search/sort helpers.

import { supabase } from '@/integrations/supabase/client';

export interface RosterLearner {
  userId: string;
  name: string;
  avatarUrl: string | null;
  enrolledAt: string | null;
  /** enrollments.completion_status — the same value course_roster_stats averages. */
  progress: number;
  needsAttention: boolean;
}

export type RosterSort = 'enrolled_desc' | 'enrolled_asc' | 'progress_desc' | 'progress_asc' | 'name_asc';

/** Learners with no progress this many days after enrolling are flagged. */
export const NOT_STARTED_DAYS = 7;

export function isNotStarted(progress: number, enrolledAt: string | null, now: Date = new Date()): boolean {
  if (progress > 0 || !enrolledAt) return false;
  const ageMs = now.getTime() - new Date(enrolledAt).getTime();
  return ageMs >= NOT_STARTED_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Loads the roster for one course. Access is decided by the database:
 * enrollments_staff_select allows admins and is_course_instructor(course) only,
 * so another instructor gets zero rows, never someone else's learners.
 * Throws on any query error so the UI can show a retry instead of an empty list.
 */
export async function fetchCourseRoster(courseId: string, now: Date = new Date()): Promise<RosterLearner[]> {
  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select('user_id, enrolled_at, completion_status')
    .eq('course_id', courseId);
  if (error) throw new Error(error.message);
  if (!enrollments || enrollments.length === 0) return [];

  const ids = enrollments.map((e) => e.user_id).filter(Boolean) as string[];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', ids);
  if (profileError) throw new Error(profileError.message);

  const byId = new Map((profiles || []).map((p) => [p.id, p]));
  return enrollments
    .filter((e) => e.user_id)
    .map((e) => {
      const p = byId.get(e.user_id as string);
      const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '';
      const progress = Math.max(0, Math.min(100, Number(e.completion_status) || 0));
      return {
        userId: e.user_id as string,
        name: name || 'Unnamed learner',
        avatarUrl: p?.avatar_url ?? null,
        enrolledAt: e.enrolled_at ?? null,
        progress,
        needsAttention: isNotStarted(progress, e.enrolled_at ?? null, now),
      };
    });
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
  const cmp: Record<RosterSort, (a: RosterLearner, b: RosterLearner) => number> = {
    enrolled_desc: (a, b) => time(b.enrolledAt) - time(a.enrolledAt),
    enrolled_asc: (a, b) => time(a.enrolledAt) - time(b.enrolledAt),
    progress_desc: (a, b) => b.progress - a.progress,
    progress_asc: (a, b) => a.progress - b.progress,
    name_asc: (a, b) => a.name.localeCompare(b.name),
  };
  return [...list].sort(cmp[sort]);
}
