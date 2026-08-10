// ABOUTME: Records grader actions on a student submission into the audit trail and
// ABOUTME: reads that trail back for a submission, module, or course.
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('submissionAudit');

export type SubmissionAuditAction =
  | 'grade_posted'
  | 'grade_changed'
  | 'grade_removed'
  | 'comment_posted'
  | 'file_downloaded'
  | 'file_previewed';

export interface SubmissionAuditEvent {
  id: string;
  actor_id: string | null;
  action: SubmissionAuditAction;
  submission_id: string;
  student_id: string | null;
  assignment_id: string | null;
  course_id: string | null;
  module_id: string | null;
  attachment_id: string | null;
  filename: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Record that a grader opened or downloaded a submitted file. Grades and
 * comments are recorded by database triggers; file access leaves no other
 * database trace because the signed URL is minted client side, so it has to be
 * reported explicitly. The RPC records auth.uid() and refuses non-staff, so a
 * caller cannot attribute the action to someone else.
 *
 * Failures are logged, never surfaced: a missing audit row must not stop a
 * grader from reading a student's work, and the row is written before the
 * download completes so a genuine access attempt is still on the record.
 */
export async function recordSubmissionFileAccess(params: {
  submissionId: string;
  action: 'file_downloaded' | 'file_previewed';
  attachmentId?: string | null;
  filename?: string | null;
}): Promise<boolean> {
  const { error } = await supabase.rpc('log_submission_file_access', {
    p_submission_id: params.submissionId,
    p_action: params.action,
    p_attachment_id: params.attachmentId ?? null,
    p_filename: params.filename ?? null,
  });
  if (error) {
    logger.error('Failed to record submission file access', error);
    return false;
  }
  return true;
}

interface AuditQuery {
  submissionId?: string;
  moduleId?: string;
  courseId?: string;
  limit?: number;
}

/**
 * Read the audit trail. Visibility is enforced by RLS: admins and the
 * instructors of the course, nobody else.
 */
export async function fetchSubmissionAuditEvents(
  query: AuditQuery,
): Promise<SubmissionAuditEvent[]> {
  let builder = supabase
    .from('submission_audit_events')
    .select(
      'id, actor_id, action, submission_id, student_id, assignment_id, course_id, module_id, attachment_id, filename, details, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(query.limit ?? 100);

  if (query.submissionId) builder = builder.eq('submission_id', query.submissionId);
  if (query.moduleId) builder = builder.eq('module_id', query.moduleId);
  if (query.courseId) builder = builder.eq('course_id', query.courseId);

  const { data, error } = await builder;
  if (error) {
    logger.error('Failed to load submission audit events', error);
    throw error;
  }
  return (data || []) as unknown as SubmissionAuditEvent[];
}

export default { recordSubmissionFileAccess, fetchSubmissionAuditEvents };
