// ABOUTME: The ONE definition of the anonymous public-catalog fixture rows. seed.sql is generated from it (gen-seed.mjs),
// ABOUTME: the specs read their expectations from it, and the self-test proves seed.sql is exactly the generated text.
//
// Synthetic, run-owned rows only. Every id is a fixed UUID in the reserved 7e57ca7a-... namespace, so a pristine check and
// a manifest can name every row this lane creates. Nothing here is claimed to exist in any hosted project.

export const ID_PREFIX = '7e57ca7a-0000-4000-8000-';
const id = (n) => `${ID_PREFIX}${String(n).padStart(12, '0')}`;

/** visibility: what an anonymous visitor is expected to see, per the CURRENT snapshot policy
 *  "Anyone can view published courses" (published = true OR auth.uid() = instructor_id) and
 *  courses_public_read_published (published = true). 'policy-report' rows are reported, not endorsed. */
export const COURSES = [
  { id: id(1), title: 'PCA Analytics Course', category: 'Analytics & BI', level: 'Beginner', estimated_hours: 2.5, duration: 99, published: true, status: 'published', created_at: '2026-01-10T00:00:00Z', visibility: 'public' },
  { id: id(2), title: 'PCA BI Course', category: 'Business Intelligence', level: 'Intermediate', estimated_hours: 12, duration: 7, published: true, status: 'published', created_at: '2026-01-09T00:00:00Z', visibility: 'public' },
  { id: id(3), title: 'PCA Leading Space Course', category: ' All categories', level: 'Beginner', estimated_hours: 1, duration: 3, published: true, status: 'published', created_at: '2026-01-08T00:00:00Z', visibility: 'public' },
  { id: id(4), title: 'PCA Newline Name Course', category: 'Data\nScience', level: 'Advanced', estimated_hours: null, duration: 40, published: true, status: 'published', created_at: '2026-01-07T00:00:00Z', visibility: 'public' },
  { id: id(5), title: 'PCA Unicode Course', category: 'Données & IA', level: 'Beginner', estimated_hours: 0.04, duration: null, published: true, status: 'published', created_at: '2026-01-06T00:00:00Z', visibility: 'public' },
  { id: id(6), title: 'PCA Private Draft Course', category: 'Secret Draft Category', level: 'Beginner', estimated_hours: 3, duration: 3, published: false, status: 'draft', created_at: '2026-01-11T00:00:00Z', visibility: 'private' },
  { id: id(7), title: 'PCA Published-Flag Draft-Status Course', category: 'Contradiction Category', level: 'Beginner', estimated_hours: 4, duration: 4, published: true, status: 'draft', created_at: '2026-01-05T00:00:00Z', visibility: 'policy-report' },
];

export const MODULES = [
  { id: id(101), course_id: id(1), title: 'PCA Published Module', week: 1, position: 1, published: true, visibility: 'public' },
  { id: id(102), course_id: id(1), title: 'PCA Unpublished Module', week: 2, position: 2, published: false, visibility: 'private' },
  { id: id(103), course_id: id(6), title: 'PCA Module In Private Course', week: 1, position: 1, published: true, visibility: 'private' },
];

/** Course ids an anonymous visitor's catalog is expected to list (current policy AND the page's published filter). */
export const ANON_CATALOG = COURSES.filter((c) => c.published).map((c) => c.id);
export const ALL_IDS = [...COURSES.map((c) => c.id), ...MODULES.map((m) => m.id)];
