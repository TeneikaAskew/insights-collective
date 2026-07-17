import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useParams, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { PageVisibilityProvider } from '@/contexts/PageVisibilityContext';
import { Toaster } from '@/components/ui/toaster';
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
const Calendar = lazy(() => import('@/pages/Calendar'));
const UserDashboard = lazy(() => import('@/pages/UserDashboard'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));

// Course & Learning Pages
const CourseList = lazy(() => import('@/pages/CourseList'));
const CourseDetail = lazy(() => import('@/pages/CourseDetail'));
const CourseBuilder = lazy(() => import('@/pages/CourseBuilder'));
const CourseLearn = lazy(() => import('@/pages/CourseLearn'));
const CourseManagement = lazy(() => import('@/pages/CourseManagement'));
const CourseManagementDashboard = lazy(() => import('@/components/course/management/CourseManagementDashboard'));
const AssignmentDetail = lazy(() => import('@/pages/AssignmentDetail'));
const LessonDetail = lazy(() => import('@/pages/LessonDetail'));
const CanvasModuleDetail = lazy(() => import('@/pages/CanvasModuleDetail'));
const EnrolledCoursesDashboard = lazy(() => import('@/pages/EnrolledCoursesDashboard'));
const CourseGradebook = lazy(() => import('@/pages/CourseGradebook'));
const CourseRubrics = lazy(() => import('@/pages/CourseRubrics'));
const RubricEdit = lazy(() => import('@/pages/RubricEdit'));
const CourseQuestionBanks = lazy(() => import('@/pages/CourseQuestionBanks'));
const CourseProgress = lazy(() => import('@/pages/CourseProgress'));
const CourseCertificate = lazy(() => import('@/pages/CourseCertificate'));
const CourseCalendar = lazy(() => import('@/pages/CourseCalendar'));
const StudentInsights = lazy(() => import('@/pages/StudentInsights'));

// Canvas-style Pages
const CanvasAssignmentSubmission = lazy(() => import('@/pages/CanvasAssignmentSubmission'));
const CanvasQuizTaking = lazy(() => import('@/pages/CanvasQuizTaking'));
const CanvasQuizResults = lazy(() => import('@/pages/CanvasQuizResults'));
const CanvasGradingInterface = lazy(() => import('@/pages/CanvasGradingInterface'));

// Interview Preparation Pages
const InterviewPrep = lazy(() => import('@/pages/InterviewPrep'));
const MockInterviews = lazy(() => import('@/pages/MockInterviews'));
const CodePractice = lazy(() => import('@/pages/CodePractice'));
const InterviewCodePractice = lazy(() => import('@/pages/interview-prep/CodePractice'));
const JobDescription = lazy(() => import('@/pages/interview-prep/JobDescription'));
const MockInterviewRoom = lazy(() => import('@/pages/interview-prep/MockInterviewRoom'));
const InterviewMockInterviews = lazy(() => import('@/pages/interview-prep/MockInterviews'));
const StarPractice = lazy(() => import('@/pages/interview-prep/StarPractice'));

// Career & AI Pages
const CareerAgent = lazy(() => import('@/pages/CareerAgent'));
const CareerPathway = lazy(() => import('@/pages/CareerPathway'));
const Assistants = lazy(() => import('@/pages/Assistants'));
const AssistantInterface = lazy(() => import('@/pages/AssistantInterface'));
const ExploreDataCareers = lazy(() => import('@/pages/ExploreDataCareers'));
const Resume = lazy(() => import('@/pages/Resume'));

// Events & Social Pages
const Events = lazy(() => import('@/pages/Events'));
const EventDetail = lazy(() => import('@/pages/EventDetail'));
const Messages = lazy(() => import('@/pages/Messages'));
const Forum = lazy(() => import('@/pages/ForumList'));
const ForumDetail = lazy(() => import('@/pages/ForumDetail'));
const ThreadDetail = lazy(() => import('@/pages/ThreadDetail'));

// Portfolio Pages
const PortfolioExplorer = lazy(() => import('@/pages/PortfolioExplorer'));
const EnhancedPortfolioEditor = lazy(() => import('@/components/portfolio/EnhancedPortfolioEditor').then(m => ({ default: m.EnhancedPortfolioEditor })));
const PublicPortfolioView = lazy(() => import('@/components/portfolio/PublicPortfolioView').then(m => ({ default: m.PublicPortfolioView })));

// Blog & Content Pages
const BlogPost = lazy(() => import('@/pages/BlogPost'));
const CreateBlogPost = lazy(() => import('@/pages/CreateBlogPost'));
const EditBlogPost = lazy(() => import('@/pages/EditBlogPost'));

// Resources & Tools Pages
const Resources = lazy(() => import('@/pages/Resources'));
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
const AdminBlogPosts = lazy(() => import('@/pages/AdminBlogPosts'));
const AdminCourses = lazy(() => import('@/pages/AdminCourses'));
const AdminCourseEdit = lazy(() => import('@/pages/AdminCourseEdit'));
const AdminEvents = lazy(() => import('@/pages/AdminEvents'));
const AdminUsers = lazy(() => import('@/pages/AdminUsers'));
const BlogAdmin = lazy(() => import('@/pages/admin/BlogAdmin'));
const AdminPageVisibility = lazy(() => import('@/pages/AdminPageVisibility'));
const FormManagement = lazy(() => import('@/pages/admin/FormManagement'));
const UnifiedFormManagement = lazy(() => import('@/pages/admin/UnifiedFormManagement'));
const LocalStorageDebug = lazy(() => import('@/pages/admin/LocalStorageDebug'));

// Legal & Info Pages
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Components
import ProtectedRoute from '@/components/ProtectedRoute';
import PageVisibilityGuard from '@/components/PageVisibilityGuard';
import { SecurityHeaders } from '@/components/security/SecurityHeaders';
import { useSecureSession } from '@/hooks/useSecureSession';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { GoogleAnalytics, SEOMetaTags } from '@/components/common/GoogleAnalytics';

import '@/App.css';

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

// Portfolio Editor Wrapper Component
function PortfolioEditorWrapper() {
  const { pageId } = useParams<{ pageId: string }>();
  const { usePortfolioPageWithProjects } = usePortfolioPages();
  const { data: portfolioPage, isLoading } = usePortfolioPageWithProjects(pageId);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">Loading portfolio...</p>
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
    <Router>
        <AuthProvider>
          <PageVisibilityProvider>
            <OnboardingProvider>
              <SecurityHeaders />
              <SecurityManager />
              <RouteTracker />
              <div className="min-h-screen bg-gray-50">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Home & Core Routes */}
                    <Route path="/" element={<Index />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/user-dashboard" element={<UserDashboard />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/calendar" element={<Calendar />} />

                    {/* Authentication Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/auth-callback" element={<AuthCallback />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />

                    {/* Profile & User Routes */}
                    <Route path="/profile" element={<Profile />} />

                     {/* Course & Learning Routes - Canvas/Blackboard Style */}
                     <Route path="/courses" element={<CourseList />} />
                     {/* Legacy route for backward compatibility with PageVisibilityContext */}
                     <Route path="/course-list" element={<CourseList />} />
                     <Route path="/course-management" element={<CourseManagementDashboard />} />
                     
                     {/* Redirect singular /course to plural /courses */}
                     <Route path="/course/:courseId" element={<CourseRedirect />} />
                     <Route path="/course/:courseId/*" element={<CourseRedirect />} />
                     <Route path="/enrolled-courses" element={<EnrolledCoursesDashboard />} />
                     <Route path="/courses/:courseId" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/modules" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/announcements" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/assignments" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/grades" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/gradebook" element={<CourseGradebook />} />
                     <Route path="/courses/:courseId/rubrics" element={<CourseRubrics />} />
                     <Route path="/courses/:courseId/rubrics/:rubricId" element={<RubricEdit />} />
                     <Route path="/courses/:courseId/question-banks" element={<CourseQuestionBanks />} />
                     <Route path="/courses/:courseId/progress" element={<CourseProgress />} />
                     <Route path="/courses/:courseId/certificate" element={<CourseCertificate />} />
                     <Route path="/courses/:courseId/calendar" element={<CourseCalendar />} />
                     <Route path="/courses/:courseId/people" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/insights" element={<StudentInsights />} />
                     <Route path="/courses/:courseId/insights/:studentId" element={<StudentInsights />} />
                     {/* Legacy management page now redirects to unified builder */}
                     <Route path="/courses/:courseId/management" element={<CourseBuilderRedirect />} />
                     {/* New Teachable/Kajabi-style builder + learner routes */}
                     <Route path="/courses/:courseId/builder" element={<CourseBuilder />} />
                     <Route path="/courses/new/builder" element={<CourseBuilder />} />
                     <Route path="/courses/:courseId/learn" element={<CourseLearn />} />
                     <Route path="/courses/:courseId/learn/:moduleId/:itemId" element={<CourseLearn />} />
                     <Route path="/courses/:courseId/modules/:moduleId/assignments/:assignmentId" element={<AssignmentDetail />} />
                     {/* Legacy student lesson/module routes now redirect to unified learner */}
                     <Route path="/courses/:courseId/modules/:moduleId/lessons/:lessonId" element={<CourseLearnRedirect />} />
                     <Route path="/courses/:courseId/modules/:moduleId" element={<CourseLearnRedirect />} />
                     <Route path="/courses/:courseId/modules/:moduleId/content/:itemId" element={<CourseLearnRedirect />} />
                     
                     {/* Canvas-style Routes */}
                     <Route path="/courses/:courseId/modules/:moduleId/assignments/:contentItemId/submit" element={<CanvasAssignmentSubmission />} />
                     <Route path="/courses/:courseId/modules/:moduleId/quizzes/:contentItemId" element={<CanvasQuizTaking />} />
                     <Route path="/courses/:courseId/modules/:moduleId/quizzes/:contentItemId/results/:submissionId" element={<CanvasQuizResults />} />
                     <Route path="/courses/:courseId/assignments/:contentItemId/grade" element={<CanvasGradingInterface />} />

                    {/* Interview Preparation Routes */}
                    <Route path="/interview-prep" element={<InterviewPrep />} />
                    <Route path="/interview-prep/code-practice" element={<InterviewCodePractice />} />
                    <Route path="/interview-prep/job-description" element={<JobDescription />} />
                    <Route path="/interview-prep/mock-interview-room" element={<MockInterviewRoom />} />
                    <Route path="/interview-prep/mock-interviews" element={<InterviewMockInterviews />} />
                    <Route path="/interview-prep/star-practice" element={<StarPractice />} />
                    <Route path="/mock-interviews" element={<MockInterviews />} />
                    <Route path="/code-practice" element={<CodePractice />} />

                    {/* Career & AI Routes */}
                    <Route path="/career-agent" element={<CareerAgent />} />
                    <Route path="/career-pathway" element={<CareerPathway />} />
                    <Route path="/assistants" element={<Assistants />} />
                    <Route path="/assistant/:id" element={<AssistantInterface />} />
                    <Route path="/assistant-interface" element={<AssistantInterface />} />
                    <Route path="/explore-data-careers" element={<ExploreDataCareers />} />
                    <Route path="/resume" element={<Resume />} />

                    {/* Events & Social Routes */}
                    <Route path="/events" element={<Events />} />
                    <Route path="/events/:id" element={<EventDetail />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/messages/:conversationId" element={<Messages />} />
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
                        <PageVisibilityGuard>
                          <PortfolioExplorer />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    } />
                    <Route path="/portfolio-editor/:pageId" element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <PortfolioEditorWrapper />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    } />
                    <Route path="/portfolio/:customUrl" element={<PublicPortfolioWrapper />} />

                    {/* Blog & Content Routes */}
                    <Route path="/blog/:slug" element={<BlogPost />} />
                    <Route path="/create-blog-post" element={<CreateBlogPost />} />
                    <Route path="/edit-blog-post/:slug" element={<EditBlogPost />} />

                    {/* Resources & Tools Routes */}
                    <Route path="/resources" element={<Resources />} />
                    <Route path="/teneika-linkedin" element={
                      <PageVisibilityGuard>
                        <TeneikaLinkedIn />
                      </PageVisibilityGuard>
                    } />
                    <Route path="/teneika-tweets" element={
                      <PageVisibilityGuard>
                        <TeneikaTweets />
                      </PageVisibilityGuard>
                    } />

                    {/* Survey & Forms Routes */}
                    <Route path="/survey" element={<Survey />} />
                    <Route path="/survey/:slug" element={<SurveyPage />} />
                    <Route path="/survey-confirmation" element={<SurveyConfirmation />} />
                    <Route path="/survey-confirmation/:slug" element={<SurveyConfirmation />} />
                    <Route path="/survey/survey-form-create" element={<SurveyFormCreate />} />
                    <Route path="/survey/survey-form-edit/:id" element={<SurveyFormEdit />} />
                    <Route path="/survey/:surveySlug/edit" element={<SurveyFormEdit />} />

                    {/* Admin Routes */}
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/activity" element={<AdminActivity />} />
                    <Route path="/admin/blog/*" element={<BlogAdmin />} />
                    <Route path="/admin/blog-posts" element={<AdminBlogPosts />} />
                    <Route path="/admin/courses" element={<AdminCourses />} />
                    <Route path="/admin/course-edit/:id" element={<AdminCourseEditRedirect />} />
                    <Route path="/admin/events" element={<AdminEvents />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/page-visibility" element={<AdminPageVisibility />} />
                    <Route path="/admin/form-management" element={<FormManagement />} />
                    <Route path="/admin/unified-form-management" element={<UnifiedFormManagement />} />
                    <Route path="/admin/unified-form-management/submissions/:slug" element={<FormManagement />} />
                    <Route path="/admin/unified-form-management/submissions/:slug/submission/:submissionId" element={<FormManagement />} />
                    <Route path="/admin/local-storage-debug" element={<ProtectedRoute requireAdmin><LocalStorageDebug /></ProtectedRoute>} />

                    {/* Legal & Info Routes */}
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />

                    {/* 404 Catch-All Route */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <Toaster />
                <WelcomeModal />
                <GoogleAnalytics />
                <SEOMetaTags />
              </div>
            </OnboardingProvider>
          </PageVisibilityProvider>
        </AuthProvider>
      </Router>
  );
}

export default App;
