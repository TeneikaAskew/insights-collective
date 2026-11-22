import type { EnhancedAssignment } from '@/types/course';
import { supabase } from '@/integrations/supabase/client';
import { fetchAll, fetchAllByIds } from '@/services/courseRosterService';

// Read every page before exposing a result. Errors reject the query, rather than
// returning partial grades. Offset pagination is not a concurrent snapshot.
export async function fetchGradebookStudents(courseId: string) {
  const enrollments = await fetchAll((from, to) => supabase.from('enrollments')
    .select('user_id').eq('course_id', courseId).order('id').range(from, to));
  const ids = [...new Set(enrollments.map(e => e.user_id).filter(Boolean))];
  const profiles = await fetchAllByIds(ids, (chunk, from, to) => supabase.from('profiles')
    .select('id, first_name, last_name, avatar_url').in('id', chunk).order('id').range(from, to));
  return profiles.map(p => ({ id: p.id,
    full_name: `${p.first_name || ''} ${p.last_name || ''}`.trim(), email: '', avatar_url: p.avatar_url }));
}

// Gradebook-specific full read; other assignment callers keep their existing API.
export async function fetchGradebookAssignments(courseId: string): Promise<EnhancedAssignment[]> {
  const rows = await fetchAll((from, to) => supabase.from('assignments')
    .select('*, module:modules(id, title, position), submission_count:assignment_submissions(count)')
    .eq('course_id', courseId).order('due_date', { ascending: true }).order('id').range(from, to));
  // Same row shape consumed by useAssignments; no changes to JSON or grading fields.
  return rows as unknown as EnhancedAssignment[];
}

export function fetchGradebookQuizzes(courseId: string) {
  return fetchAll((from, to) => supabase.from('quizzes').select('*, content_items!inner(course_id)')
    .eq('content_items.course_id', courseId).order('created_at', { ascending: true }).order('id').range(from, to));
}

export function fetchGradebookAssignmentSubmissions(ids: string[]) {
  return fetchAllByIds(ids, (chunk, from, to) => supabase.from('assignment_submissions')
    .select('*').in('assignment_id', chunk).order('id').range(from, to));
}

export function fetchGradebookQuizSubmissions(ids: string[]) {
  return fetchAllByIds(ids, (chunk, from, to) => supabase.from('quiz_submissions')
    .select('*').in('quiz_id', chunk).order('id').range(from, to));
}
