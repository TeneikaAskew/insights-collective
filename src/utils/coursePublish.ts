// ABOUTME: Single publish contract for courses: how to write published/draft state, how to read it,
// ABOUTME: a readiness guard, and an error-checked course update used by the builder and admin hooks.
import { supabase } from '@/integrations/supabase/client';

/**
 * Canonical rule: a course is public when `published = true`. That is the
 * column RLS (`courses_public_read_published`) and every public reader filter
 * on. `status` is a legacy mirror some consumers still read, so every write
 * goes through `publishPatch` to keep both columns in step.
 */
export const PUBLISHED_COLUMN = 'published' as const;

export function publishPatch(next: boolean): { published: boolean; status: 'published' | 'draft' } {
  return { published: next, status: next ? 'published' : 'draft' };
}

interface ReadinessItem { published?: boolean | null }
interface ReadinessModule { unassigned?: boolean; published?: boolean | null; items?: ReadinessItem[] }
interface ReadinessCourse { title?: string | null }

/** Reasons a course cannot be published yet. Empty array = ready. */
export function publishReadinessIssues(course: ReadinessCourse, modules: ReadinessModule[]): string[] {
  const issues: string[] = [];
  if (!course.title || !course.title.trim()) issues.push('Give the course a title.');
  const assignedModules = modules.filter((m) => !m.unassigned);
  if (assignedModules.length === 0 && modules.some((m) => m.unassigned && m.items?.length)) {
    issues.push('Unassigned lessons are preserved, but students can only see lessons in published sections. Add a section with a published lesson before publishing this course.');
    return issues;
  }
  if (assignedModules.length === 0) {
    issues.push('Add at least one section to the curriculum.');
    return issues;
  }
  const items = assignedModules.flatMap((m) => m.items || []);
  if (items.length === 0) {
    issues.push('Add at least one lesson to a section.');
    return issues;
  }
  const visible = assignedModules.some(
    (m) => m.published !== false && (m.items || []).some((i) => i.published === true),
  );
  if (!visible) {
    issues.push('Publish at least one lesson inside a published section, otherwise students would see an empty course.');
  }
  return issues;
}

export type CourseUpdateResult<T = Record<string, unknown>> =
  | { ok: true; row: T }
  | { ok: false; error: string };

/**
 * Update a course row and confirm the write landed. Returns ok:false when
 * Supabase reports an error OR when zero rows were changed (missing row, or
 * RLS silently filtered the update out).
 */
export async function updateCourse<T = Record<string, unknown>>(
  courseId: string,
  patch: Record<string, unknown>,
): Promise<CourseUpdateResult<T>> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .update({ ...patch, updated_at: new Date().toISOString() } as any)
      .eq('id', courseId)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message || 'The course could not be saved.' };
    if (!data) {
      return {
        ok: false,
        error: 'No course was updated. It may have been removed, or you may not have permission to edit it.',
      };
    }
    return { ok: true, row: data as T };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error — the course could not be saved.' };
  }
}
