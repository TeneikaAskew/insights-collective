/**
 * Centralized route builders for E2E tests.
 * Dynamic IDs are read from environment variables; fall back to placeholder strings
 * that will show a clear error if a test is run without proper test data seeding.
 */

export const TestIds = {
  courseId: process.env.E2E_TEST_COURSE_ID || 'test-course-id',
  moduleId: process.env.E2E_TEST_MODULE_ID || 'test-module-id',
  assignmentContentItemId: process.env.E2E_TEST_ASSIGNMENT_ID || 'test-assignment-id',
  quizContentItemId: process.env.E2E_TEST_QUIZ_ID || 'test-quiz-id',
  submissionId: process.env.E2E_TEST_SUBMISSION_ID || 'test-submission-id',
  forumId: process.env.E2E_TEST_FORUM_ID || '1',
  threadId: process.env.E2E_TEST_THREAD_ID || 'test-thread-id',
  eventId: process.env.E2E_TEST_EVENT_ID || 'test-event-id',
  blogSlug: process.env.E2E_TEST_BLOG_SLUG || 'test-blog-post',
  surveySlug: process.env.E2E_TEST_SURVEY_SLUG || 'test-survey',
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
  profile: '/profile',
  notifications: '/notifications',
  calendar: '/calendar',
  resources: '/resources',

  // Courses
  courses: '/courses',
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
  resume: '/resume',
  exploreDataCareers: '/explore-data-careers',

  // Events & Social
  events: '/events',
  eventDetail: (id = TestIds.eventId) => `/events/${id}`,
  messages: '/messages',
  forum: '/forum',
  forumDetail: (id = TestIds.forumId) => `/forum/${id}`,
  threadDetail: (id = TestIds.threadId) => `/thread/${id}`,

  // Portfolio
  portfolioExplorer: '/portfolio-explorer',
  portfolioEditor: (id = TestIds.portfolioPageId) => `/portfolio-editor/${id}`,
  publicPortfolio: (url = TestIds.publicPortfolioUrl) => `/portfolio/${url}`,

  // Blog
  blogPost: (slug = TestIds.blogSlug) => `/blog/${slug}`,
  dataBlueprintSeries: '/data-blueprint-series',

  // Survey
  survey: '/survey',
  surveyPage: (slug = TestIds.surveySlug) => `/survey/${slug}`,
  surveyConfirmation: '/survey-confirmation',

  // Admin
  admin: '/admin',
  adminActivity: '/admin/activity',
  adminUsers: '/admin/users',
  adminCourses: '/admin/courses',
  adminBlog: '/admin/blog',
  adminEvents: '/admin/events',
  adminForms: '/admin/forms',
  adminPageVisibility: '/admin/page-visibility',
  adminLocalStorageDebug: '/admin/local-storage-debug',

  // Legal
  privacyPolicy: '/privacy-policy',
  termsOfService: '/terms-of-service',
};
