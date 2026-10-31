// ABOUTME: Course-scoped analytics for the builder Reports tab — enrollment, completion, module progression, work status.
// ABOUTME: Reuses courseRosterService and the gradebook model so numbers match the Students tab and gradebook.

import { supabase } from '@/integrations/supabase/client';
import { fetchCourseRoster, type RosterLearner } from '@/services/courseRosterService';
import {
  buildGradebook,
  type RawAssignmentSubmission,
  type RawQuizSubmission,
} from '@/components/course/gradebook/gradebookData';

const DONE_STATES = ['read', 'completed', 'graded'];

export interface ReportModule { id: string; title: string; position: number | null }
export interface ReportItem { id: string; module_id: string | null; type: string; title: string | null }
export interface ReportProgression { user_id: string; content_item_id: string; workflow_state: string | null }
export interface ReportGradeItem { id: string; title?: string | null; points?: number | null }

export interface CourseReportInput {
  learners: RosterLearner[];
  modules: ReportModule[];
  items: ReportItem[];
  progressions: ReportProgression[];
  assignments: ReportGradeItem[];
  quizzes: ReportGradeItem[];
  assignmentSubmissions: RawAssignmentSubmission[];
  quizSubmissions: RawQuizSubmission[];
}

export interface ModuleProgressRow {
  id: string;
  title: string;
  itemCount: number;
  /** Learners who finished every published item in the module. */
  learnersCompleted: number;
  /** Average share of the module's items finished, across all enrolled learners (0–100). */
  avgCompletion: number | null;
}

export interface CourseReport {
  enrolled: number;
  completed: number;
  completionRate: number | null;
  avgProgress: number | null;
  notStarted: number;
  modules: ModuleProgressRow[];
  work: { graded: number; awaitingGrading: number; notSubmitted: number; total: number };
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

export function computeCourseReport(input: CourseReportInput): CourseReport {
  const learnerIds = new Set(input.learners.map((l) => l.userId));
  const enrolled = input.learners.length;
  const completed = input.learners.filter((l) => l.progress >= 100).length;

  // Only count progress rows from enrolled learners on this course's items.
  const itemIds = new Set(input.items.map((i) => i.id));
  const done = new Set(
    input.progressions
      .filter((p) => learnerIds.has(p.user_id) && itemIds.has(p.content_item_id) && DONE_STATES.includes(p.workflow_state ?? ''))
      .map((p) => `${p.user_id}:${p.content_item_id}`),
  );

  const modules = [...input.modules]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((m) => {
      const mItems = input.items.filter((i) => i.module_id === m.id);
      let learnersCompleted = 0;
      let shareSum = 0;
      for (const id of learnerIds) {
        const n = mItems.filter((i) => done.has(`${id}:${i.id}`)).length;
        if (mItems.length > 0 && n === mItems.length) learnersCompleted += 1;
        if (mItems.length > 0) shareSum += n / mItems.length;
      }
      return {
        id: m.id,
        title: m.title,
        itemCount: mItems.length,
        learnersCompleted,
        avgCompletion: mItems.length > 0 && enrolled > 0 ? Math.round((shareSum / enrolled) * 100) : null,
      };
    });

  const { cells } = buildGradebook({
    students: input.learners.map((l) => ({ id: l.userId, full_name: l.name })),
    assignments: input.assignments,
    quizzes: input.quizzes,
    assignmentSubmissions: input.assignmentSubmissions,
    quizSubmissions: input.quizSubmissions,
  });
  const work = { graded: 0, awaitingGrading: 0, notSubmitted: 0, total: 0 };
  for (const c of Object.values(cells)) {
    work.total += 1;
    if (c.status === 'graded') work.graded += 1;
    else if (c.status === 'submitted') work.awaitingGrading += 1;
    else work.notSubmitted += 1;
  }

  return {
    enrolled,
    completed,
    completionRate: pct(completed, enrolled),
    avgProgress: enrolled ? Math.round(input.learners.reduce((s, l) => s + l.progress, 0) / enrolled) : null,
    notStarted: input.learners.filter((l) => l.needsAttention).length,
    modules,
    work,
  };
}

const must = <T,>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
};

/**
 * Every query is filtered to this course's ids, and RLS decides what comes back.
 * Throws on any failure so the tab shows an error, never partial zeros.
 */
export async function fetchCourseReport(courseId: string): Promise<CourseReport> {
  const learners = await fetchCourseRoster(courseId);

  const [modules, items, assignments, quizzes] = await Promise.all([
    supabase.from('modules').select('id, title, position').eq('course_id', courseId).eq('published', true).then(must<ReportModule[]>),
    supabase.from('content_items').select('id, module_id, type, title').eq('course_id', courseId).eq('published', true).then(must<ReportItem[]>),
    supabase.from('assignments').select('id, title, points').eq('course_id', courseId).then(must<ReportGradeItem[]>),
    supabase
      .from('quizzes')
      .select('id, title, points_possible, content_items!inner(course_id)')
      .eq('content_items.course_id', courseId)
      .then(must<Array<{ id: string; title: string | null; points_possible: number | null }>>),
  ]);

  const itemIds = items.map((i) => i.id);
  const aIds = assignments.map((a) => a.id);
  const qIds = quizzes.map((q) => q.id);
  const empty = Promise.resolve([] as never[]);

  const [progressions, assignmentSubmissions, quizSubmissions] = await Promise.all([
    itemIds.length && learners.length
      ? supabase.from('content_item_progressions').select('user_id, content_item_id, workflow_state').in('content_item_id', itemIds).then(must<ReportProgression[]>)
      : empty,
    aIds.length
      ? supabase.from('assignment_submissions').select('id, user_id, assignment_id, grade, workflow_state, attempt, submitted_at').in('assignment_id', aIds).then(must<RawAssignmentSubmission[]>)
      : empty,
    qIds.length
      ? supabase.from('quiz_submissions').select('id, user_id, quiz_id, score, kept_score, attempt, workflow_state').in('quiz_id', qIds).then(must<RawQuizSubmission[]>)
      : empty,
  ]);

  return computeCourseReport({
    learners,
    modules,
    items,
    progressions,
    assignments,
    quizzes: quizzes.map((q) => ({ id: q.id, title: q.title, points: q.points_possible })),
    assignmentSubmissions,
    quizSubmissions,
  });
}
