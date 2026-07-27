/**
 * Centralized route builders for E2E tests.
 * Dynamic IDs are read from environment variables; fall back to placeholder strings
 * that will show a clear error if a test is run without proper test data seeding.
 */

export const TestIds = {
  // Defaults point at the canonical seeded "Introduction to Data Science" course
  // and one of its seeded assignment content_items so specs work in local sandbox
  // runs without needing the CI env vars set.
  courseId: process.env.E2E_TEST_COURSE_ID || '660e8400-e29b-41d4-a716-446655440001',
  moduleId: process.env.E2E_TEST_MODULE_ID || 'test-module-id',
  lessonId: process.env.E2E_TEST_LESSON_ID || 'test-lesson-id',
  assignmentContentItemId: process.env.E2E_TEST_ASSIGNMENT_ID || '19d80f57-3623-47a7-9e12-05a86f671f21',
  quizContentItemId: process.env.E2E_TEST_QUIZ_ID || 'test-quiz-id',
  submissionId: process.env.E2E_TEST_SUBMISSION_ID || 'test-submission-id',
  forumId: process.env.E2E_TEST_FORUM_ID || '1',
  threadId: process.env.E2E_TEST_THREAD_ID || 'test-thread-id',
  // Seeded event (supabase/migrations/20260718121602_*.sql). The old
  // 'test-event-id' placeholder is not a UUID, so the app issued a query
  // Postgres rejected with 22P02 and the console-error fixture failed the
  // spec — testing the placeholder rather than the page.
  eventId: process.env.E2E_TEST_EVENT_ID || 'dd0e8400-e29b-41d4-a716-446655440001',
  blogSlug: process.env.E2E_TEST_BLOG_SLUG || 'test-blog-post',
  surveySlug: process.env.E2E_TEST_SURVEY_SLUG || 'test-survey',
  surveyFormId: process.env.E2E_TEST_SURVEY_FORM_ID || 'test-form-id',
  formSlug: process.env.E2E_TEST_FORM_SLUG || process.env.E2E_TEST_SURVEY_SLUG || 'test-survey',
  portfolioPageId: process.env.E2E_TEST_PORTFOLIO_ID || 'test-portfolio-page-id',
  publicPortfolioUrl: process.env.E2E_TEST_PORTFOLIO_URL || 'testuser',
  assistantId: process.env.E2E_TEST_ASSISTANT_ID || 'career-explorer',
  rubricId: process.env.E2E_TEST_RUBRIC_ID || 'test-rubric-id',
  adminCourseId: process.env.E2E_TEST_ADMIN_COURSE_ID || process.env.E2E_TEST_COURSE_ID || 'test-course-id',
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
  userDashboard: '/user-dashboard',
  profile: '/profile',
  notifications: '/notifications',
  calendar: '/calendar',
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
  messages: '/messages',
  forum: '/forum',
  forums: '/forums',
  forumDetail: (id = TestIds.forumId) => `/forum/${id}`,
  threadDetail: (id = TestIds.threadId) => `/thread/${id}`,

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
  adminUnifiedFormManagement: '/admin/unified-form-management',
  adminLocalStorageDebug: '/admin/local-storage-debug',

  // Legal
  privacyPolicy: '/privacy-policy',
  termsOfService: '/terms-of-service',

  // Fallbacks
  notFound: '/definitely-not-a-real-route',
};
