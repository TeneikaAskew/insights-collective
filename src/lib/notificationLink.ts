// ABOUTME: Resolves the destination a notification opens when clicked, falling back
// ABOUTME: to a course section derived from the notification type when `link` is null.

export interface NotificationLinkSource {
  type?: string | null;
  link?: string | null;
  course_id?: string | null;
  courseId?: string | null;
}

/**
 * The course section each notification type belongs to.
 *
 * Rows written before the notify_* triggers learned to set `link` carry
 * `link IS NULL` — 427 `assignment_graded` rows on the live project as of
 * this writing. Those used to render as `<Link to="#">`, which is a link that
 * looks clickable, marks nothing, and goes nowhere. The type still says where
 * the row belongs, so derive the destination from it instead.
 */
const SECTION_BY_TYPE: Record<string, string> = {
  assignment: 'assignments',
  assignment_submitted: 'assignments',
  quiz: 'assignments',
  assignment_grade: 'grades',
  assignment_graded: 'grades',
  submission_feedback: 'grades',
  feedback: 'grades',
  grade: 'grades',
  announcement: 'announcements',
  course_announcement: 'announcements',
  message: 'messages',
};

/**
 * Where clicking this notification should land, or null when there is nowhere
 * meaningful to go (no stored link and no course to fall back to).
 *
 * Callers must treat null as "no navigation" rather than substituting "#" —
 * a notification that opens nothing should not be dressed up as a link.
 */
export function resolveNotificationLink(notification: NotificationLinkSource): string | null {
  if (notification?.link) return notification.link;

  const courseId = notification?.course_id ?? notification?.courseId;
  if (!courseId) return null;

  const section = SECTION_BY_TYPE[notification?.type ?? ''];
  return section ? `/courses/${courseId}/${section}` : `/courses/${courseId}`;
}
