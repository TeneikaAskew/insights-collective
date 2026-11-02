// ABOUTME: Fixed ids and titles for the builder-authoring acceptance lane (UNRUN source). Every seeded id is in the
// ABOUTME: 9b6e0000-... namespace, disjoint from the gradebook (9b6b/9b6c), public-catalog and shared e2e seeds.

export const INSTRUCTOR_ID = 'e2e00000-0000-4000-8000-000000000002'; // e2e-instructor (local actors step)
export const OTHER_AUTHOR_ID = 'e2e00000-0000-4000-8000-000000000001'; // e2e-admin: the "changed account" persona (PENDING controls only)

/** Course A: three sections, three lessons in section A1. Reordered and deleted through the UI. */
export const A = {
  course: '9b6e0000-0000-4000-8000-000000000001',
  title: 'Builder Acceptance Course A',
  sections: [
    { id: '9b6e0000-0000-4000-8000-000000000011', title: 'BA Section One', position: 0 },
    { id: '9b6e0000-0000-4000-8000-000000000012', title: 'BA Section Two', position: 1 },
    { id: '9b6e0000-0000-4000-8000-000000000013', title: 'BA Section Three', position: 2 },
  ],
  lessons: [
    { id: '9b6e0000-0000-4000-8000-000000000101', section: 0, title: 'BA Lesson Alpha', position: 0 },
    { id: '9b6e0000-0000-4000-8000-000000000102', section: 0, title: 'BA Lesson Beta', position: 1 },
    { id: '9b6e0000-0000-4000-8000-000000000103', section: 0, title: 'BA Lesson Gamma', position: 2 },
  ],
  /** Deleted through the UI (positive delete control). */
  deletable: { id: '9b6e0000-0000-4000-8000-000000000104', section: 1, title: 'BA Lesson Deletable', position: 0 },
  /** Removed out of band after the builder loaded, so the UI delete matches zero rows (zero-row control). */
  vanishing: { id: '9b6e0000-0000-4000-8000-000000000105', section: 2, title: 'BA Lesson Vanishing', position: 0 },
};

/** Course B: two sections; the target of the course-switch control (PENDING). */
export const B = {
  course: '9b6e0000-0000-4000-8000-000000000002',
  title: 'Builder Acceptance Course B',
  sections: [
    { id: '9b6e0000-0000-4000-8000-000000000021', title: 'BB Section One', position: 0 },
    { id: '9b6e0000-0000-4000-8000-000000000022', title: 'BB Section Two', position: 1 },
  ],
};

/** Wizard-created courses carry this marker plus the run nonce in their title; cleanup requires both. */
export const CREATED_TITLE_PREFIX = 'BA Wizard Course';
export const createdTitle = (nonce) => `${CREATED_TITLE_PREFIX} ${nonce}`;

export const SEEDED_COURSES = [A.course, B.course];
export const SEEDED_MODULES = [...A.sections, ...B.sections].map((s) => s.id);
export const SEEDED_ITEMS = [...A.lessons, A.deletable, A.vanishing].map((l) => l.id);

export const route = {
  curriculum: (course) => `/courses/${course}/builder?view=curriculum`,
  newCourse: '/courses/new/builder',
};
