import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { PageVisibilityProvider } from '@/contexts/PageVisibilityContext';
import { Toaster } from '@/components/ui/toaster';
import WelcomeModal from '@/components/onboarding/WelcomeModal';
import { Spinner } from '@/components/ui/spinner';

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
const CourseManagement = lazy(() => import('@/pages/CourseManagement'));
const CourseManageMaterials = lazy(() => import('@/pages/CourseManageMaterials'));
const CourseEdit = lazy(() => import('@/pages/CourseEdit'));
const AssignmentDetail = lazy(() => import('@/pages/AssignmentDetail'));
const LessonDetail = lazy(() => import('@/pages/LessonDetail'));
const ModuleDetail = lazy(() => import('@/pages/ModuleDetail'));
const EnrolledCoursesDashboard = lazy(() => import('@/pages/EnrolledCoursesDashboard'));

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
const DataBlueprintSeries = lazy(() => import('@/pages/DataBlueprintSeries'));
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
const AdminForms = lazy(() => import('@/pages/AdminForms'));
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
  <div className="flex justify-center items-center h-96">
    <Spinner size="lg" />
  </div>
);

// Portfolio Editor Wrapper Component
function PortfolioEditorWrapper() {
  const { pageId } = useParams<{ pageId: string }>();
  const { usePortfolioPageWithProjects } = usePortfolioPages();
  const { data: portfolioPage, isLoading } = usePortfolioPageWithProjects(pageId);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!portfolioPage) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Portfolio page not found</p>
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

function App() {
  return (
    <Router>
        <AuthProvider>
          <PageVisibilityProvider>
            <OnboardingProvider>
              <SecurityHeaders />
              <SecurityManager />
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

                    {/* Profile & User Routes */}
                    <Route path="/profile" element={<Profile />} />

                     {/* Course & Learning Routes - Canvas/Blackboard Style */}
                     <Route path="/courses" element={<CourseList />} />
                     <Route path="/course-list" element={<CourseList />} />
                     <Route path="/enrolled-courses" element={<EnrolledCoursesDashboard />} />
                     <Route path="/courses/:courseId" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/modules" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/announcements" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/assignments" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/grades" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/calendar" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/people" element={<CourseDetail />} />
                     <Route path="/courses/:courseId/edit" element={<CourseEdit />} />
                     <Route path="/courses/:courseId/management" element={<CourseManagement />} />
                     <Route path="/courses/:courseId/manage-materials" element={<CourseManageMaterials />} />
                     <Route path="/courses/:courseId/modules/:moduleId/assignments/:assignmentId" element={<AssignmentDetail />} />
                     <Route path="/courses/:courseId/modules/:moduleId/lessons/:lessonId" element={<LessonDetail />} />
                     <Route path="/courses/:courseId/modules/:moduleId" element={<ModuleDetail />} />

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
                    <Route path="/forum" element={<Forum />} />
                    <Route path="/forums" element={<Forum />} />
                    <Route path="/forum/:forumId" element={<ForumDetail />} />
                    <Route path="/courses/:courseId/forums" element={<Forum />} />
                    <Route path="/courses/:courseId/forums/:forumId" element={<ForumDetail />} />
                    <Route path="/thread/:threadId" element={<ThreadDetail />} />
                    <Route path="/courses/:courseId/forums/:forumId/threads/:threadId" element={<ThreadDetail />} />

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
                    <Route path="/data-blueprint-series" element={<DataBlueprintSeries />} />
                    <Route path="/create-blog-post" element={<CreateBlogPost />} />
                    <Route path="/edit-blog-post/:slug" element={<EditBlogPost />} />

                    {/* Resources & Tools Routes */}
                    <Route path="/resources" element={<Resources />} />
                    <Route path="/teneika-linkedin" element={<TeneikaLinkedIn />} />
                    <Route path="/teneika-tweets" element={<TeneikaTweets />} />

                    {/* Survey & Forms Routes */}
                    <Route path="/survey" element={<Survey />} />
                    <Route path="/survey/:slug" element={<SurveyPage />} />
                    <Route path="/survey-confirmation" element={<SurveyConfirmation />} />
                    <Route path="/survey-confirmation/:slug" element={<SurveyConfirmation />} />
                    <Route path="/survey/survey-form-create" element={<SurveyFormCreate />} />
                    <Route path="/survey/survey-form-edit/:id" element={<SurveyFormEdit />} />

                    {/* Admin Routes */}
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/activity" element={<AdminActivity />} />
                    <Route path="/admin/blog/*" element={<BlogAdmin />} />
                    <Route path="/admin/blog-posts" element={<AdminBlogPosts />} />
                    <Route path="/admin/courses" element={<AdminCourses />} />
                    <Route path="/admin/course-edit/:id" element={<AdminCourseEdit />} />
                    <Route path="/admin/events" element={<AdminEvents />} />
                    <Route path="/admin/forms" element={<AdminForms />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/page-visibility" element={<AdminPageVisibility />} />
                    <Route path="/admin/form-management" element={<FormManagement />} />
                    <Route path="/admin/unified-form-management" element={<UnifiedFormManagement />} />
                    <Route path="/admin/local-storage-debug" element={<LocalStorageDebug />} />

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