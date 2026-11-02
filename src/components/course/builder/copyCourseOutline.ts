// ABOUTME: "Copy from another course" for the new-course wizard (T-18): lists the author's own courses and
// ABOUTME: reads one course's sections and lessons (title, type, lesson text) into a wizard outline.
import type { OutlineSection } from '@/components/course/builder/teachable/NewCourseWizard';

type Client = { from: (table: string) => any };

export interface CopyableCourse {
  id: string;
  title: string;
}

/** Courses this author owns, by title. Copying is limited to the author's own courses. */
export async function listCopyableCourses(client: Client, userId: string): Promise<CopyableCourse[]> {
  const { data, error } = await client
    .from('courses')
    .select('id, title')
    .eq('instructor_id', userId)
    .order('title', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CopyableCourse[]).map((c) => ({ id: c.id, title: c.title || 'Untitled course' }));
}

/**
 * The source course's sections and lessons in their saved order. Lesson text is copied; quiz questions,
 * assignment settings and other per-lesson settings are not (the new lessons start with defaults).
 */
export async function loadCourseOutline(client: Client, courseId: string): Promise<OutlineSection[]> {
  const mods = await client.from('modules').select('id, title, position').eq('course_id', courseId).order('position', { ascending: true });
  if (mods.error) throw mods.error;
  const items = await client
    .from('content_items')
    .select('id, module_id, title, type, content, position')
    .eq('course_id', courseId)
    .order('position', { ascending: true });
  if (items.error) throw items.error;
  const byModule = new Map<string, any[]>();
  for (const it of items.data ?? []) {
    if (!it.module_id) continue;
    const list = byModule.get(it.module_id) ?? [];
    list.push(it);
    byModule.set(it.module_id, list);
  }
  return (mods.data ?? []).map((m: any) => ({
    title: m.title || 'Untitled section',
    lessons: (byModule.get(m.id) ?? [])
      .sort((a, z) => (a.position ?? 0) - (z.position ?? 0))
      .map((it) => ({ title: it.title || 'Untitled lesson', type: it.type, content: it.content ?? '' })),
  }));
}
