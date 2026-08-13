// ABOUTME: Covers the destination a notification resolves to, including the
// ABOUTME: legacy rows that carry no `link` at all.
import { describe, it, expect } from 'vitest';
import { resolveNotificationLink } from '../notificationLink';

describe('resolveNotificationLink', () => {
  it('prefers the stored link', () => {
    expect(
      resolveNotificationLink({
        type: 'course_announcement',
        link: '/courses/c1/announcements?announcement=a1',
        course_id: 'c1',
      }),
    ).toBe('/courses/c1/announcements?announcement=a1');
  });

  // REGRESSION: 427 assignment_graded rows on the live project carry
  // link IS NULL. They used to render as <Link to="#"> — clickable, and a
  // no-op in both directions: no navigation and no mark-as-read.
  it.each([
    ['assignment_graded', '/courses/c1/grades'],
    ['submission_feedback', '/courses/c1/grades'],
    ['assignment_submitted', '/courses/c1/assignments'],
    ['quiz', '/courses/c1/assignments'],
    ['course_announcement', '/courses/c1/announcements'],
  ])('derives a destination from type %s when link is null', (type, expected) => {
    expect(resolveNotificationLink({ type, link: null, course_id: 'c1' })).toBe(expected);
  });

  it('falls back to the course itself for an unrecognised type', () => {
    expect(resolveNotificationLink({ type: 'something_new', link: null, course_id: 'c1' })).toBe(
      '/courses/c1',
    );
  });

  it('accepts a camelCase courseId', () => {
    expect(resolveNotificationLink({ type: 'quiz', link: null, courseId: 'c1' })).toBe(
      '/courses/c1/assignments',
    );
  });

  // Null means "render this as something other than a link" — callers must not
  // substitute "#", which is what produced the dead rows in the first place.
  it('returns null when there is no link and no course', () => {
    expect(resolveNotificationLink({ type: 'system', link: null, course_id: null })).toBeNull();
  });
});
