// ABOUTME: Canonical definition of which content_item_progressions.workflow_state
// ABOUTME: values count as "done" for progress, dashboards and certification.

/**
 * Kept in parity with the database, which is the authority on completion:
 * check_course_completion() and auto_issue_certificate_on_progression() both
 * accept 'read' or 'completed'. 'graded' is a post-completion state for
 * assignments and counts as done too.
 *
 * Every consumer (progress hooks, dashboard metrics, certificates) must read
 * completion through this module so the UI can never disagree with itself.
 */
export const DONE_PROGRESSION_STATES = ['read', 'completed', 'graded'] as const;

export function isProgressionDone(workflowState?: string | null): boolean {
  return !!workflowState && (DONE_PROGRESSION_STATES as readonly string[]).includes(workflowState);
}

/**
 * Assessed content (assignments, quizzes) is only done once the learner has
 * actually submitted it. Reading, scrolling, "Next" and "Mark as done" must
 * never complete it — only the submission handlers may.
 */
export const ASSESSED_CONTENT_TYPES = ['assignment', 'quiz'] as const;

export function isAssessedContentType(type?: string | null): boolean {
  return !!type && (ASSESSED_CONTENT_TYPES as readonly string[]).includes(type);
}

export type CompletionSource = 'view' | 'submission';

/** Whether a completion request from this source may mark an item of this type done. */
export function canMarkComplete(type: string | null | undefined, source: CompletionSource): boolean {
  return !isAssessedContentType(type) || source === 'submission';
}
