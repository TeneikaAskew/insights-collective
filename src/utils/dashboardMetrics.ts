// ABOUTME: Compute learner dashboard metrics from enrollments, progressions, certificates.
// ABOUTME: Kept pure so unit tests can exercise edge cases without hitting Supabase.

import { isProgressionDone } from '@/utils/progressionStates';


export interface EnrollmentRow {
  course_id: string;
}

export interface ProgressionRow {
  course_id: string;
  workflow_state: string | null;
}

export interface CertificateRow {
  course_id: string;
}

export interface DashboardMetrics {
  enrolled: number;
  inProgress: number;
  completed: number;
}

/**
 * A course counts as "in progress" when the learner is enrolled, has at least
 * one content item with workflow_state 'read' or 'completed', and has NOT been
 * issued a completion certificate for that course.
 */
export function computeDashboardMetrics(
  enrollments: EnrollmentRow[],
  progressions: ProgressionRow[],
  certificates: CertificateRow[],
): DashboardMetrics {
  const enrolledIds = new Set(enrollments.map((e) => e.course_id));
  const certifiedIds = new Set(certificates.map((c) => c.course_id));

  const startedIds = new Set<string>();
  for (const p of progressions) {
    if (!p.course_id) continue;
    if (p.workflow_state === 'read' || p.workflow_state === 'completed') {
      startedIds.add(p.course_id);
    }
  }

  let inProgress = 0;
  for (const id of enrolledIds) {
    if (startedIds.has(id) && !certifiedIds.has(id)) inProgress += 1;
  }

  return {
    enrolled: enrolledIds.size,
    inProgress,
    completed: Array.from(certifiedIds).filter((id) => enrolledIds.has(id)).length,
  };
}
