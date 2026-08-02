/**
 * Centralized route builders for E2E tests.
 *
 * Every default below is a row e2e/fixtures/seed.sql creates or asserts. They
 * used to be readable placeholders — 'test-module-id', 'test-quiz-id' — which
 * read like a clear signal of missing setup but behaved as the opposite:
 * Postgres rejects a non-UUID with 22P02, so the page never fetched anything and
 * the spec asserted against an error state. Eight route builders were affected,
 * and every one of them passed.
 *
 * That failure mode is also what forced the two blanket suppressions in
 * console-errors.fixture.ts, which between them hid every /rest/v1/ error and
 * 110 of the app's 187 logger prefixes — including two real 42703 page breaks.
 *
 * So: if a default here is not a real row, the fix is to seed the row, not to
 * suppress the error it produces.
 */

export const TestIds = {
  // The canonical seeded "Introduction to Data Science" course and its first
  // module, both from the production seed and asserted by seed.sql.
  courseId: process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001',
  moduleId: process.env.E2E_TEST_MODULE_ID || '770e8400-e29b-41d4-a716-446655440001',
  // "What is Data Science?" — the first page-type content item in that module.
  lessonId: process.env.E2E_TEST_LESSON_ID || 'b25050bd-9e06-4e89-b994-8eb176546ad7',
  assignmentContentItemId: process.env.E2E_TEST_ASSIGNMENT_ID || '19d80f57-3623-47a7-9e12-05a86f671f21',
  // "Submission Formats Exercise" — the fixture assignment seed.sql creates that
  // offers ALL THREE submission types. The production assignment above offers
  // file_upload only, so the Text Entry and Website URL tabs correctly never
  // render on it; specs asserting on those tabs need this one or they are
  // asserting against UI that is legitimately absent.
  assignmentAllTypesContentItemId: 'cccc3333-3333-3333-3333-333333333333',
  // "Foundations Check-in" quiz, with two questions that have real options and a
  // correct answer. A quiz whose questions have an empty options array renders
  // "No options configured for this question", which is the same dead end as a
  // placeholder ID.
  quizContentItemId: process.env.E2E_TEST_QUIZ_ID || 'aaaa1111-1111-1111-1111-111111111111',
  // A graded attempt on that quiz by the member.
  submissionId: process.env.E2E_TEST_SUBMISSION_ID || 'dddd4444-4444-4444-4444-444444444444',
  // Seeded event (supabase/migrations/20260718121602_*.sql). The old
  // 'test-event-id' placeholder is not a UUID, so the app issued a query
  // Postgres rejected with 22P02 and the console-error fixture failed the
  // spec — testing the placeholder rather than the page.
  eventId: process.env.E2E_TEST_EVENT_ID || 'dd0e8400-e29b-41d4-a716-446655440001',
  blogSlug: process.env.E2E_TEST_BLOG_SLUG || 'test-blog-post',
  surveySlug: process.env.E2E_TEST_SURVEY_SLUG || 'e2e-fixture-survey',
  surveyFormId: process.env.E2E_TEST_SURVEY_FORM_ID || 'aaab7777-7777-7777-7777-777777777777',
  formSlug: process.env.E2E_TEST_FORM_SLUG || process.env.E2E_TEST_SURVEY_SLUG || 'e2e-fixture-survey',
  // Owned by the member: the editor checks ownership, and pointing this at a
  // real user's page would put a test one keystroke from editing live content.
  portfolioPageId: process.env.E2E_TEST_PORTFOLIO_ID || 'ffff6666-6666-6666-6666-666666666666',
  publicPortfolioUrl: process.env.E2E_TEST_PORTFOLIO_URL || 'e2e-member',
  assistantId: process.env.E2E_TEST_ASSISTANT_ID || 'career-explorer',
  // Must belong to courseId — rubricEdit() defaults both segments, and a rubric
  // on another course renders Not Found.
  rubricId: process.env.E2E_TEST_RUBRIC_ID || 'eeee5555-5555-5555-5555-555555555555',
  adminCourseId:
    process.env.E2E_TEST_ADMIN_COURSE_ID ||
    process.env.E2E_TEST_COURSE_ID ||
    '660e8400-e29b-41d4-a716-446655440001',
};

export const Routes = {
  // Auth
  login: '/login',
  register: '/register',
  resetPassword: '/reset-password',
  authCallback: '/auth/callback',

  // Core
  landing: '/',
  dashboard: '/dashboard',
  profile: '/profile',
  notifications: '/notifications',
  // Calendar is a Dashboard tab now, not a page of its own.
  calendar: '/dashboard?tab=calendar',
  resources: '/resources',
  teneikaLinkedIn: '/teneika-linkedin',
  teneikaTweets: '/teneika-tweets',

  // Courses
  courses: '/courses',
  legacyCourseList: '/course-list',
  courseManagementDashboard: '/course-management',
  legacyCourse: (id = TestIds.courseId) => `/course/${id}`,
  courseDetail: (id = TestIds.courseId) => `/courses/${id}`,
  courseModules: (id = TestIds.courseId) => `/courses/${id}/modules`,
  courseAssignments: (id = TestIds.courseId) => `/courses/${id}/assignments`,
  courseAnnouncements: (id = TestIds.courseId) => `/courses/${id}/announcements`,
  courseGrades: (id = TestIds.courseId) => `/courses/${id}/grades`,
  coursePeople: (id = TestIds.courseId) => `/courses/${id}/people`,
  courseLearn: (id = TestIds.courseId) => `/courses/${id}/learn`,
  courseManagement: (id = TestIds.courseId) => `/courses/${id}/management`,
  courseBuilder: (id = TestIds.courseId) => `/courses/${id}/builder`,
  newCourseBuilder: '/courses/new/builder',
  enrolledCourses: '/enrolled-courses',
  gradebook: (id = TestIds.courseId) => `/courses/${id}/gradebook`,
  rubrics: (id = TestIds.courseId) => `/courses/${id}/rubrics`,
  rubricEdit: (courseId = TestIds.courseId, rubricId = TestIds.rubricId) =>
    `/courses/${courseId}/rubrics/${rubricId}`,
  questionBanks: (id = TestIds.courseId) => `/courses/${id}/question-banks`,
  courseProgress: (id = TestIds.courseId) => `/courses/${id}/progress`,
  certificate: (id = TestIds.courseId) => `/courses/${id}/certificate`,
  courseCalendar: (id = TestIds.courseId) => `/courses/${id}/calendar`,

  // Assignments / Quizzes
  moduleDetail: (courseId = TestIds.courseId, moduleId = TestIds.moduleId) =>
    `/courses/${courseId}/modules/${moduleId}`,
  lessonDetail: (
    courseId = TestIds.courseId,
    moduleId = TestIds.moduleId,
    lessonId = TestIds.lessonId,
  ) => `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
  assignmentSubmit: (
    courseId = TestIds.courseId,
    moduleId = TestIds.moduleId,
    itemId = TestIds.assignmentContentItemId,
  ) => `/courses/${courseId}/modules/${moduleId}/assignments/${itemId}/submit`,
  quizTaking: (
    courseId = TestIds.courseId,
    moduleId = TestIds.moduleId,
    itemId = TestIds.quizContentItemId,
  ) => `/courses/${courseId}/modules/${moduleId}/quizzes/${itemId}`,
  quizResults: (
    courseId = TestIds.courseId,
    moduleId = TestIds.moduleId,
    itemId = TestIds.quizContentItemId,
    subId = TestIds.submissionId,
  ) => `/courses/${courseId}/modules/${moduleId}/quizzes/${itemId}/results/${subId}`,
  gradingInterface: (courseId = TestIds.courseId, itemId = TestIds.assignmentContentItemId) =>
    `/courses/${courseId}/assignments/${itemId}/grade`,

  // Interview Prep
  interviewPrep: '/interview-prep',
  codePractice: '/interview-prep/code-practice',
  mockInterviews: '/interview-prep/mock-interviews',
  mockInterviewRoom: '/interview-prep/mock-interview-room',
  starPractice: '/interview-prep/star-practice',
  jobDescription: '/interview-prep/job-description',

  // Career
  careerAgent: '/career-agent',
  careerPathway: '/career-pathway',
  assistants: '/assistants',
  assistantInterface: (id = TestIds.assistantId) => `/assistant/${id}`,
  assistantInterfaceLegacy: '/assistant-interface',
  resume: '/resume',
  exploreDataCareers: '/explore-data-careers',

  // Events & Social
  events: '/events',
  eventDetail: (id = TestIds.eventId) => `/events/${id}`,
  // Messages moved into the Dashboard beside the Calendar, and into each course.
  // `/messages` still resolves — App.tsx redirects it — and route-parity asserts that.
  messages: '/dashboard?tab=messages',
  messagesLegacy: '/messages',
  messagesLegacyThread: (id = '00000000-0000-4000-8000-000000000000') => `/messages/${id}`,
  courseMessages: (id = TestIds.courseId) => `/courses/${id}/messages`,
  forum: '/forum',
  forums: '/forums',
  // The forum feature is gone; App.tsx redirects every /forum and /thread route
  // to /dashboard, so these ids are never used in a query. Kept as literals
  // rather than TestIds entries — a seeded fixture would imply a page that reads
  // it, and route-parity.spec.ts asserts the redirect.
  forumDetail: (id = '1') => `/forum/${id}`,
  threadDetail: (id = '1') => `/thread/${id}`,

  // Portfolio
  portfolioExplorer: '/portfolio-explorer',
  portfolioEditor: (id = TestIds.portfolioPageId) => `/portfolio-editor/${id}`,
  publicPortfolio: (url = TestIds.publicPortfolioUrl) => `/portfolio/${url}`,

  // Blog
  blog: '/blog',
  blogPost: (slug = TestIds.blogSlug) => `/blog/${slug}`,
  adminBlogNew: '/admin/blog/new',

  // Survey
  survey: '/survey',
  surveyPage: (slug = TestIds.surveySlug) => `/survey/${slug}`,
  surveyConfirmation: '/survey-confirmation',
  surveyConfirmationSlug: (slug = TestIds.surveySlug) => `/survey-confirmation/${slug}`,
  surveyFormCreate: '/survey/survey-form-create',
  surveyFormEdit: (id = TestIds.surveyFormId) => `/survey/survey-form-edit/${id}`,

  // Admin
  admin: '/admin',
  adminActivity: '/admin/activity',
  adminUsers: '/admin/users',
  adminCourses: '/admin/courses',
  adminCourseEdit: (id = TestIds.adminCourseId) => `/admin/course-edit/${id}`,
  adminBlog: '/admin/blog',
  adminEvents: '/admin/events',
  adminForms: '/admin/forms',
  adminPageVisibility: '/admin/page-visibility',
  adminFormManagement: '/admin/form-management',
  adminUnifiedFormManagement: '/admin/forms',
  adminLocalStorageDebug: '/admin/debug/storage',

  // Legal
  privacyPolicy: '/privacy-policy',
  termsOfService: '/terms-of-service',

  // Fallbacks
  notFound: '/definitely-not-a-real-route',
};
