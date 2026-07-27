// ABOUTME: Deterministic Playwright test fixtures — stable UUIDs and metadata for
// ABOUTME: courses, modules, quizzes, enrollments and grading data seeded by
// ABOUTME: e2e/fixtures/seed.sql. Import these constants from any spec instead of
// ABOUTME: hard-coding IDs so the whole suite stays consistent when seeds change.

export const TEST_USERS = {
  member: {
    email: process.env.E2E_TEST_EMAIL || 'e2e-member@insightscollective.org',
    password: process.env.E2E_TEST_PASSWORD || 'TestPass123!',
  },
  instructor: {
    email: process.env.E2E_INSTRUCTOR_EMAIL || 'e2e-instructor@insightscollective.org',
    password: process.env.E2E_INSTRUCTOR_PASSWORD,
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
  },
} as const;

/**
 * Deterministic course fixtures. IDs match those created by e2e/fixtures/seed.sql
 * and existing production seed data. The member account is enrolled in
 * `enrolledCourse` and NOT in `unenrolledCourse`.
 */
export const FIXTURE_COURSES = {
  enrolled: {
    id: process.env.E2E_ENROLLED_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001',
    title: 'Introduction to Data Science',
  },
  unenrolled: {
    id: process.env.E2E_UNENROLLED_COURSE_ID || '660e8400-e29b-41d4-a716-446655440002',
    title: 'Advanced Machine Learning',
  },
} as const;

/**
 * Helper: base URL for the target under test. Every spec should read this
 * instead of using a raw string.
 */
export const E2E_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';

/**
 * Skip a test with a loud, actionable reason. Prevents "silent pass" specs
 * that would otherwise succeed with an empty state hiding a real regression.
 */
export function loudSkip(condition: boolean, reason: string) {
  if (condition) throw new Error(`E2E FIXTURE MISSING: ${reason}`);
}
