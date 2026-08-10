import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useParams, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { DialogsProvider } from '@/components/dialogs/DialogsProvider';
import { PageVisibilityProvider } from '@/contexts/PageVisibilityContext';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import WelcomeModal from '@/components/onboarding/WelcomeModal';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

// Critical pages loaded immediately
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Register from '@/pages/Register';

// Lazy load non-critical pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Profile = lazy(() => import('@/pages/Profile'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));

// Course & Learning Pages
const CourseList = lazy(() => import('@/pages/CourseList'));
const CourseDetail = lazy(() => import('@/pages/CourseDetail'));
const CourseBuilder = lazy(() => import('@/pages/CourseBuilder'));
const CourseLearn = lazy(() => import('@/pages/CourseLearn'));
const CourseManagementDashboard = lazy(() => import('@/components/course/management/CourseManagementDashboard'));
const AssignmentDetail = lazy(() => import('@/pages/AssignmentDetail'));
const EnrolledCoursesDashboard = lazy(() => import('@/pages/EnrolledCoursesDashboard'));
const CourseGradebook = lazy(() => import('@/pages/CourseGradebook'));
const CourseRubrics = lazy(() => import('@/pages/CourseRubrics'));
const RubricEdit = lazy(() => import('@/pages/RubricEdit'));
const CourseQuestionBanks = lazy(() => import('@/pages/CourseQuestionBanks'));
const CourseProgress = lazy(() => import('@/pages/CourseProgress'));
const CourseCertificate = lazy(() => import('@/pages/CourseCertificate'));
const VerifyCertificate = lazy(() => import('@/pages/VerifyCertificate'));
const CourseCalendar = lazy(() => import('@/pages/CourseCalendar'));
const StudentInsights = lazy(() => import('@/pages/StudentInsights'));

// Canvas-style Pages
const CanvasAssignmentSubmission = lazy(() => import('@/pages/CanvasAssignmentSubmission'));
const CanvasQuizTaking = lazy(() => import('@/pages/CanvasQuizTaking'));
const CanvasQuizResults = lazy(() => import('@/pages/CanvasQuizResults'));
const CanvasGradingInterface = lazy(() => import('@/pages/CanvasGradingInterface'));
const InstructorAssignments = lazy(() => import('@/pages/InstructorAssignments'));
const CourseInstructors = lazy(() => import('@/pages/CourseInstructors'));
const CourseMaterials = lazy(() => import('@/pages/CourseMaterials'));
const CourseQuizResults = lazy(() => import('@/pages/CourseQuizResults'));

// Interview Preparation Pages
const InterviewPrep = lazy(() => import('@/pages/InterviewPrep'));
const InterviewCodePractice = lazy(() => import('@/pages/interview-prep/CodePractice'));
const JobDescription = lazy(() => import('@/pages/interview-prep/JobDescription'));
const MockInterviewRoom = lazy(() => import('@/pages/interview-prep/MockInterviewRoom'));
const InterviewMockInterviews = lazy(() => import('@/pages/interview-prep/MockInterviews'));
const StarPractice = lazy(() => import('@/pages/interview-prep/StarPractice'));

// Career & AI Pages
const CareerPathway = lazy(() => import('@/pages/CareerPathway'));
const Assistants = lazy(() => import('@/pages/Assistants'));
const AssistantInterface = lazy(() => import('@/pages/AssistantInterface'));
const ExploreDataCareers = lazy(() => import('@/pages/ExploreDataCareers'));
const Resume = lazy(() => import('@/pages/Resume'));
// Dev-only design preview (tree-shaken out of production builds)
const SoftStudioPreview = import.meta.env.DEV
  ? lazy(() => import('@/pages/dev/SoftStudioPreview'))
  : null;

// Dev-only badge surfacing failed Supabase queries. A failed query otherwise
// renders as an empty list, which is indistinguishable from "no results" —
// the reason three broken pages shipped unnoticed. Same DEV guard as above, so
// it is tree-shaken from production builds.
const SupabaseIssueBadge = import.meta.env.DEV
  ? lazy(() => import('@/components/dev/SupabaseIssueBadge'))
  : null;

// Events & Social Pages
const Events = lazy(() => import('@/pages/Events'));
const EventDetail = lazy(() => import('@/pages/EventDetail'));
const CourseMessages = lazy(() => import('@/pages/CourseMessages'));

// Portfolio Pages
const PortfolioExplorer = lazy(() => import('@/pages/PortfolioExplorer'));
const EnhancedPortfolioEditor = lazy(() => import('@/components/portfolio/EnhancedPortfolioEditor').then(m => ({ default: m.EnhancedPortfolioEditor })));
const PublicPortfolioView = lazy(() => import('@/components/portfolio/PublicPortfolioView').then(m => ({ default: m.PublicPortfolioView })));

// Blog & Content Pages
const Blog = lazy(() => import('@/pages/Blog'));
const BlogPost = lazy(() => import('@/pages/BlogPost'));

// Resources & Tools Pages
const Resources = lazy(() => import('@/pages/Resources'));
const SalaryGuide = lazy(() => import('@/pages/SalaryGuide'));
const TeneikaLinkedIn = lazy(() => import('@/pages/TeneikaLinkedIn'));
const TeneikaTweets = lazy(() => import('@/pages/TeneikaTweets'));

// Survey & Forms Pages
const Survey = lazy(() => import('@/pages/Survey'));
const SurveyConfirmation = lazy(() => import('@/pages/SurveyConfirmation'));
const SurveyFormCreate = lazy(() => import('@/pages/survey/SurveyFormCreate'));
const SurveyFormEdit = lazy(() => import('@/pages/survey/SurveyFormEdit'));
const SurveyPage = lazy(() => import('@/pages/survey/SurveyPage'));

// Admin Pages
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AdminActivity = lazy(() => import('@/pages/AdminActivity'));
const AdminCourses = lazy(() => import('@/pages/AdminCourses'));
const AdminEvents = lazy(() => import('@/pages/AdminEvents'));
const AdminUsers = lazy(() => import('@/pages/AdminUsers'));
const BlogAdmin = lazy(() => import('@/pages/admin/BlogAdmin'));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const PageVisibilityManager = lazy(() => import('@/pages/admin/PageVisibilityManager'));
const FormManagement = lazy(() => import('@/pages/admin/FormManagement'));
const UnifiedFormManagement = lazy(() => import('@/pages/admin/UnifiedFormManagement'));
const LocalStorageDebug = lazy(() => import('@/pages/admin/LocalStorageDebug'));

// Legal & Info Pages
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Components
import ProtectedRoute from '@/components/ProtectedRoute';
import VisibilityGate from '@/components/VisibilityGate';
import { SecurityHeaders } from '@/components/security/SecurityHeaders';
import { useSecureSession } from '@/hooks/useSecureSession';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { GoogleAnalytics, SEOMetaTags } from '@/components/common/GoogleAnalytics';
import CourseFeedbackButton from '@/components/course/CourseFeedbackButton';

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex flex-col justify-center items-center h-96 gap-3">
    <Spinner size="lg" />
    <p className="text-sm text-muted-foreground">Loading...</p>
  </div>
);

// Course Redirect Component
function CourseRedirect() {
  const location = useLocation();
  const redirectPath = location.pathname.replace('/course/', '/courses/');
  return <Navigate to={redirectPath} replace />;
}

// Redirect legacy admin course edit page to the unified builder
function AdminCourseEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/courses/${id}/builder`} replace />;
}

// Redirect legacy course management routes to the unified builder
function CourseBuilderRedirect() {
  const { courseId } = useParams<{ courseId: string }>();
  return <Navigate to={`/courses/${courseId}/builder`} replace />;
}

// Redirect legacy per-module/lesson URLs to the unified learner
function CourseLearnRedirect() {
  const { courseId, moduleId, itemId, lessonId } = useParams<{
    courseId: string;
    moduleId?: string;
    itemId?: string;
    lessonId?: string;
  }>();
  const target = itemId || lessonId;
  const dest = target
    ? `/courses/${courseId}/learn/${moduleId}/${target}`
    : `/courses/${courseId}/learn`;
  return <Navigate to={dest} replace />;
}

// A /messages/:conversationId link now opens the Dashboard's Messages tab with that
// thread selected. Threads used to have their own page; they are a panel now, so the id
// travels in the query string.
function LegacyConversationRedirect() {
  const { conversationId } = useParams<{ conversationId: string }>();
  return (
    <Navigate to={`/dashboard?tab=messages&conversation=${conversationId ?? ''}`} replace />
  );
}

// Portfolio Editor Wrapper Component
function PortfolioEditorWrapper() {
  const { pageId } = useParams<{ pageId: string }>();
  const { usePortfolioPageWithProjects } = usePortfolioPages();
  const { data: portfolioPage, isLoading, error } = usePortfolioPageWithProjects(pageId);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">Loading portfolio...</p>
      </div>
    );
  }

  // A failed read is not a missing portfolio. Telling someone their page does
  // not exist when the request never came back sends them off to create the one
  // they already have.
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-3 text-center px-4">
        <p className="text-muted-foreground" role="alert">
          Could not load your portfolio. {error instanceof Error ? error.message : 'Please try again.'}
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (!portfolioPage) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-3 text-center">
        <p className="text-muted-foreground">Portfolio page not found.</p>
        <Button variant="outline" asChild><Link to="/portfolio-explorer">Back to Explorer</Link></Button>
      </div>
    );
  }

  return <EnhancedPortfolioEditor portfolioPage={portfolioPage} />;
}

// Public Portfolio View Wrapper Component
function PublicPortfolioWrapper() {
  return <PublicPortfolioView />;
}

// Security Component to monitor sessions
function SecurityManager() {
  useSecureSession(); // Initialize secure session monitoring
  return null;
}

// Track the current route in sessionStorage so a refresh-to-root can restore it
function RouteTracker() {
  const location = useLocation();
  React.useEffect(() => {
    const excluded = ['/', '/login', '/register', '/auth-callback', '/auth/callback', '/reset-password'];
    if (!excluded.includes(location.pathname)) {
      sessionStorage.setItem('lastVisitedPath', location.pathname + location.search);
    }
  }, [location]);
  return null;
}

function App() {
  return (
    // Default is light — dark (Ink Studio) and system remain explicit choices
    // in the theme toggle; only users who never picked get light.
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="ic-theme">
    <Router>
        <AuthProvider>
          <PageVisibilityProvider>
            <OnboardingProvider>
              <TooltipProvider delayDuration={200}>
              <DialogsProvider>
              <SecurityHeaders />
              <SecurityManager />
              <RouteTracker />
              <div className="min-h-screen bg-background">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/*
                      Page-visibility gate. Routes render only when visible
                      for the current user's role; hidden pages mount a
                      Coming Soon page instead — the page component itself
                      never runs. Policy (which paths are gated, subtree
                      governance, aliases) lives in src/config/pageManifest.ts.
                      Auth, legal, public and /admin surfaces short-circuit
                      through UNGATED_PATHS.
                    */}
                    <Route element={<VisibilityGate />}>
                    {/* Home & Core Routes */}
                    <Route path="/" element={<Index />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

                    {/* Authentication Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/auth-callback" element={<AuthCallback />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />

                    {/* Profile & User Routes */}
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                     {/* Course & Learning Routes - Canvas/Blackboard Style */}
                     <Route path="/courses" element={<CourseList />} />
                     {/* Legacy route for backward compatibility with PageVisibilityContext */}
                     <Route path="/course-list" element={<CourseList />} />
                     <Route path="/course-management" element={<CourseManagementDashboard />} />
                     
                     {/* Redirect singular /course to plural /courses */}
                     <Route path="/course/:courseId" element={<CourseRedirect />} />
                     <Route path="/course/:courseId/*" element={<CourseRedirect />} />
                     <Route path="/enrolled-courses" element={<ProtectedRoute><EnrolledCoursesDashboard /></ProtectedRoute>} />
                     <Route path="/courses/:courseId" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/modules" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/announcements" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/assignments" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/grades" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/gradebook" element={<ProtectedRoute><CourseGradebook /></ProtectedRoute>} />
                     <Route path="/courses/:courseId/rubrics" element={<CourseRubrics />} />
                     <Route path="/courses/:courseId/rubrics/:rubricId" element={<RubricEdit />} />
                     <Route path="/courses/:courseId/question-banks" element={<CourseQuestionBanks />} />
                     <Route path="/courses/:courseId/progress" element={<CourseProgress />} />
                    <Route path="/courses/:courseId/certificate" element={<CourseCertificate />} />
                    <Route path="/verify-certificate/:code" element={<VerifyCertificate />} />
                     <Route path="/courses/:courseId/calendar" element={<CourseCalendar />} />
                     <Route path="/courses/:courseId/messages" element={<CourseMessages />} />
                     <Route path="/courses/:courseId/people" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/insights" element={<StudentInsights />} />
                     <Route path="/courses/:courseId/insights/:studentId" element={<StudentInsights />} />
                     {/* Legacy management page now redirects to unified builder */}
                     <Route path="/courses/:courseId/management" element={<CourseBuilderRedirect />} />
                     {/* New Teachable/Kajabi-style builder + learner routes */}
                     <Route path="/courses/:courseId/builder" element={<ProtectedRoute><CourseBuilder /></ProtectedRoute>} />
                     <Route path="/courses/new/builder" element={<ProtectedRoute><CourseBuilder /></ProtectedRoute>} />
                     <Route path="/courses/:courseId/learn" element={<CourseLearn />} />
                     <Route path="/courses/:courseId/learn/:moduleId/:itemId" element={<CourseLearn />} />
                     <Route path="/courses/:courseId/modules/:moduleId/assignments/:assignmentId" element={<AssignmentDetail />} />
                     {/* Legacy student lesson/module routes now redirect to unified learner */}
                     <Route path="/courses/:courseId/modules/:moduleId/lessons/:lessonId" element={<CourseLearnRedirect />} />
                     <Route path="/courses/:courseId/modules/:moduleId" element={<CourseLearnRedirect />} />
                     <Route path="/courses/:courseId/modules/:moduleId/content/:itemId" element={<CourseLearnRedirect />} />
                     
                     {/* Canvas-style Routes */}
                     <Route path="/courses/:courseId/modules/:moduleId/assignments/:contentItemId/submit" element={<ProtectedRoute><CanvasAssignmentSubmission /></ProtectedRoute>} />
                     <Route path="/courses/:courseId/modules/:moduleId/quizzes/:contentItemId" element={<CanvasQuizTaking />} />
                     <Route path="/courses/:courseId/modules/:moduleId/quizzes/:contentItemId/results/:submissionId" element={<CanvasQuizResults />} />
                     <Route path="/courses/:courseId/assignments/:contentItemId/grade" element={<ProtectedRoute><CanvasGradingInterface /></ProtectedRoute>} />
                     <Route path="/courses/:courseId/manage/assignments" element={<InstructorAssignments />} />
                     <Route path="/courses/:courseId/instructors" element={<CourseInstructors />} />
                     <Route path="/courses/:courseId/materials" element={<CourseMaterials />} />
                     <Route path="/courses/:courseId/quiz-results" element={<CourseQuizResults />} />


                    {/* Interview Preparation Routes */}
                    <Route path="/interview-prep" element={<InterviewPrep />} />
                    <Route path="/interview-prep/code-practice" element={<InterviewCodePractice />} />
                    <Route path="/interview-prep/job-description" element={<JobDescription />} />
                    <Route path="/interview-prep/mock-interview-room" element={<MockInterviewRoom />} />
                    <Route path="/interview-prep/mock-interview-room/:sessionId" element={<MockInterviewRoom />} />
                    <Route path="/interview-prep/mock-interviews" element={<InterviewMockInterviews />} />
                    <Route path="/interview-prep/star-practice" element={<StarPractice />} />
                    {/* Legacy near-duplicate pages — redirect to the interview-prep versions */}
                    <Route path="/mock-interviews" element={<Navigate to="/interview-prep/mock-interviews" replace />} />
                    <Route path="/code-practice" element={<Navigate to="/interview-prep/code-practice" replace />} />

                    {/* Career & AI Routes */}
                    {/* The career conversation and pathway are one page now */}
                    <Route path="/career-agent" element={<Navigate to="/career-pathway" replace />} />
                    <Route path="/career-pathway" element={<CareerPathway />} />
                    <Route path="/assistants" element={<Assistants />} />
                    <Route path="/assistant/:id" element={<AssistantInterface />} />
                    <Route path="/assistant-interface" element={<AssistantInterface />} />
                    <Route path="/explore-data-careers" element={<ExploreDataCareers />} />
                    <Route path="/resume" element={<Resume />} />
                    {SoftStudioPreview && (
                      <Route path="/dev/soft-studio" element={<SoftStudioPreview />} />
                    )}

                    {/* Events & Social Routes */}
                    <Route path="/events" element={<Events />} />
                    <Route path="/events/:id" element={<EventDetail />} />
                    {/* Messages moved into the surfaces they belong to: the Dashboard tab
                        beside the Calendar, and each course's own page. These two paths are
                        kept because a conversation link has been sendable for a long time. */}
                    <Route path="/messages" element={<Navigate to="/dashboard?tab=messages" replace />} />
                    <Route path="/messages/:conversationId" element={<LegacyConversationRedirect />} />
                    {/* Forums disabled — redirect all forum routes to dashboard */}
                    <Route path="/forum" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/forums" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/forum/:forumId" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/courses/:courseId/forums" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/courses/:courseId/forums/:forumId" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/thread/:threadId" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/courses/:courseId/forums/:forumId/threads/:threadId" element={<Navigate to="/dashboard" replace />} />

                    {/* Portfolio Routes */}
                    <Route path="/portfolio-explorer" element={
                      <ProtectedRoute>
                        <PortfolioExplorer />
                      </ProtectedRoute>
                    } />
                    <Route path="/portfolio-editor/:pageId" element={
                      <ProtectedRoute>
                        <PortfolioEditorWrapper />
                      </ProtectedRoute>
                    } />
                    {/* Bare /portfolio-editor, with no page id, matched nothing and fell
                        through to the 404 — reachable by trimming the id off the URL, or
                        by any link written from memory. It is not a page in the manifest
                        and never was, so send it to the explorer, which is where you pick
                        which portfolio to edit. */}
                    <Route
                      path="/portfolio-editor"
                      element={<Navigate to="/portfolio-explorer" replace />}
                    />
                    <Route path="/portfolio/:customUrl" element={<PublicPortfolioWrapper />} />

                    {/* Blog & Content Routes */}
                    {/* The index route must come with the detail route: BlogPost
                        links back to /blog in four places, all of which 404'd
                        while this page sat unrouted. */}
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/blog/:slug" element={<BlogPost />} />

                    {/* Resources & Tools Routes */}
                    <Route path="/resources" element={<Resources />} />
                    <Route path="/resources/salary-guide" element={<SalaryGuide />} />
                    <Route path="/teneika-linkedin" element={<TeneikaLinkedIn />} />
                    <Route path="/teneika-tweets" element={<TeneikaTweets />} />

                    {/* Survey & Forms Routes */}
                    <Route path="/survey" element={<Survey />} />
                    <Route path="/survey/:slug" element={<SurveyPage />} />
                    <Route path="/survey-confirmation" element={<SurveyConfirmation />} />
                    <Route path="/survey-confirmation/:slug" element={<SurveyConfirmation />} />
                    {/* Survey builder tools are admin form tooling, guarded
                        like the admin Forms area */}
                    <Route path="/survey/survey-form-create" element={<ProtectedRoute requireAdmin><SurveyFormCreate /></ProtectedRoute>} />
                    <Route path="/survey/survey-form-edit/:id" element={<ProtectedRoute requireAdmin><SurveyFormEdit /></ProtectedRoute>} />
                    <Route path="/survey/:surveySlug/edit" element={<ProtectedRoute requireAdmin><SurveyFormEdit /></ProtectedRoute>} />

                    {/* Admin Routes — one shell (AdminLayout), one guard at
                        the layout. Every tool is a nested route rendered into
                        the shell's Outlet. */}
                    <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="courses" element={<AdminCourses />} />
                      <Route path="course-edit/:id" element={<AdminCourseEditRedirect />} />
                      <Route path="events" element={<AdminEvents />} />
                      <Route path="activity" element={<AdminActivity />} />
                      <Route path="forms" element={<UnifiedFormManagement />} />
                      <Route path="forms/submissions/:slug" element={<FormManagement />} />
                      <Route path="forms/submissions/:slug/submission/:submissionId" element={<FormManagement />} />
                      {/* Legacy form URLs keep working inside the shell */}
                      <Route path="form-management" element={<FormManagement />} />
                      <Route path="unified-form-management" element={<Navigate to="/admin/forms" replace />} />
                      <Route path="unified-form-management/submissions/:slug" element={<FormManagement />} />
                      <Route path="unified-form-management/submissions/:slug/submission/:submissionId" element={<FormManagement />} />
                      <Route path="page-visibility" element={<PageVisibilityManager />} />
                      {/* Debug Tools is a dev-only surface: it inspects raw
                          localStorage and should not ship to production. */}
                      {import.meta.env.DEV && (
                        <Route path="debug/storage" element={<LocalStorageDebug />} />
                      )}
                      {/* Legacy URL always redirects: to the debug tool in dev,
                          to the admin dashboard in production builds */}
                      <Route path="local-storage-debug" element={<Navigate to={import.meta.env.DEV ? '/admin/debug/storage' : '/admin'} replace />} />

                    </Route>
                    {/* Blog admin allows instructors (RLS grants them CRUD on
                        their own posts), so it carries its own guard and wraps
                        the shell explicitly. */}
                    <Route path="/admin/blog/*" element={
                      <ProtectedRoute requireAdmin allowInstructor>
                        <AdminLayout><BlogAdmin /></AdminLayout>
                      </ProtectedRoute>
                    } />

                    {/* Legal & Info Routes */}
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    {/* The signup form linked to these short forms, which were
                        never routed, so "you agree to our Terms of Service" led
                        to a 404 on the one screen where those documents legally
                        matter. The links are fixed; these aliases keep the short
                        URLs working wherever else they were handed out. */}
                    <Route path="/terms" element={<Navigate to="/terms-of-service" replace />} />
                    <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />

                    {/* 404 Catch-All Route */}
                    <Route path="*" element={<NotFound />} />
                    </Route>
                  </Routes>
                </Suspense>
                <Toaster />
                {/* The app calls two toast APIs. Ten source files — the grade
                    history, rubric, question-bank and course-calendar hooks, the
                    course materials and calendar pages, the canvas editor, the AI
                    content dialog, the curriculum view and the add-event modal —
                    import `toast` from `sonner`, whose renderer was never
                    mounted. Every one of those toasts was discarded, including
                    the error ones: an instructor whose grade-history write failed
                    got no signal at all. Mounting it is the whole fix. */}
                <SonnerToaster />
                <WelcomeModal />
                <CourseFeedbackButton />
                <GoogleAnalytics />
                <SEOMetaTags />
                {SupabaseIssueBadge && (
                  <Suspense fallback={null}>
                    <SupabaseIssueBadge />
                  </Suspense>
                )}
              </div>
              </DialogsProvider>
              </TooltipProvider>
            </OnboardingProvider>
          </PageVisibilityProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
