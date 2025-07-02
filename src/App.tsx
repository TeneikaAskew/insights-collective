
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { PageVisibilityProvider } from '@/contexts/PageVisibilityContext';
import { Toaster } from '@/components/ui/toaster';
import WelcomeModal from '@/components/onboarding/WelcomeModal';

// Authentication Pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ResetPassword from '@/pages/ResetPassword';
import AuthCallback from '@/pages/AuthCallback';

// Core Application Pages
import Index from '@/pages/Index';
import Dashboard from '@/pages/Dashboard';
import Profile from '@/pages/Profile';
import Notifications from '@/pages/Notifications';
import Calendar from '@/pages/Calendar';
import UserDashboard from '@/pages/UserDashboard';

// Course & Learning Pages
import CourseList from '@/pages/CourseList';
import CourseDetail from '@/pages/CourseDetail';
import CourseManagement from '@/pages/CourseManagement';
import CourseManageMaterials from '@/pages/CourseManageMaterials';
import AssignmentDetail from '@/pages/AssignmentDetail';
import LessonDetail from '@/pages/LessonDetail';
import ModuleDetail from '@/pages/ModuleDetail';

// Interview Preparation Pages
import InterviewPrep from '@/pages/InterviewPrep';
import MockInterviews from '@/pages/MockInterviews';
import CodePractice from '@/pages/CodePractice';
import InterviewCodePractice from '@/pages/interview-prep/CodePractice';
import JobDescription from '@/pages/interview-prep/JobDescription';
import MockInterviewRoom from '@/pages/interview-prep/MockInterviewRoom';
import InterviewMockInterviews from '@/pages/interview-prep/MockInterviews';
import StarPractice from '@/pages/interview-prep/StarPractice';

// Career & AI Pages
import CareerAgent from '@/pages/CareerAgent';
import CareerPathway from '@/pages/CareerPathway';
import Assistants from '@/pages/Assistants';
import AssistantInterface from '@/pages/AssistantInterface';
import ExploreDataCareers from '@/pages/ExploreDataCareers';
import Resume from '@/pages/Resume';

// Events & Social Pages
import Events from '@/pages/Events';
import EventDetail from '@/pages/EventDetail';
import Messages from '@/pages/Messages';
import Forum from '@/pages/ForumList';
import ForumDetail from '@/pages/ForumDetail';
import ThreadDetail from '@/pages/ThreadDetail';

// Portfolio Pages
import PortfolioExplorer from '@/pages/PortfolioExplorer';
import { EnhancedPortfolioEditor } from '@/components/portfolio/EnhancedPortfolioEditor';
import { PublicPortfolioView } from '@/components/portfolio/PublicPortfolioView';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { Spinner } from '@/components/ui/spinner';
import { GoogleAnalytics, SEOMetaTags } from '@/components/common/GoogleAnalytics';

// Blog & Content Pages
import BlogPost from '@/pages/BlogPost';
import DataBlueprintSeries from '@/pages/DataBlueprintSeries';
import CreateBlogPost from '@/pages/CreateBlogPost';
import EditBlogPost from '@/pages/EditBlogPost';

// Resources & Tools Pages
import Resources from '@/pages/Resources';
import TeneikaLinkedIn from '@/pages/TeneikaLinkedIn';
import TeneikaTweets from '@/pages/TeneikaTweets';

// Survey & Forms Pages
import Survey from '@/pages/Survey';
import SurveyConfirmation from '@/pages/SurveyConfirmation';
import SurveyFormCreate from '@/pages/survey/SurveyFormCreate';
import SurveyFormEdit from '@/pages/survey/SurveyFormEdit';
import SurveyPage from '@/pages/survey/SurveyPage';

// Admin Pages
import AdminDashboard from '@/pages/AdminDashboard';
import AdminActivity from '@/pages/AdminActivity';
import AdminBlogPosts from '@/pages/AdminBlogPosts';
import AdminCourses from '@/pages/AdminCourses';
import AdminCourseEdit from '@/pages/AdminCourseEdit';
import AdminEvents from '@/pages/AdminEvents';
import AdminForms from '@/pages/AdminForms';
import AdminUsers from '@/pages/AdminUsers';
import BlogAdmin from '@/pages/admin/BlogAdmin';
import AdminPageVisibility from '@/pages/AdminPageVisibility';
import FormManagement from '@/pages/admin/FormManagement';
import UnifiedFormManagement from '@/pages/admin/UnifiedFormManagement';
import LocalStorageDebug from '@/pages/admin/LocalStorageDebug';

// Legal & Info Pages
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';
import NotFound from '@/pages/NotFound';

// Components
import ProtectedRoute from '@/components/ProtectedRoute';
import PageVisibilityGuard from '@/components/PageVisibilityGuard';
import { SecurityHeaders } from '@/components/security/SecurityHeaders';
import { useSecureSession } from '@/hooks/useSecureSession';

import '@/App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

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
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <PageVisibilityProvider>
            <OnboardingProvider>
              <SecurityHeaders />
              <SecurityManager />
              <div className="min-h-screen bg-gray-50">
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

                  {/* Course & Learning Routes - FIXED: Removed problematic redirect */}
                  <Route path="/courses" element={<CourseList />} />
                  <Route path="/course-list" element={<CourseList />} />
                  <Route path="/courses/:courseId" element={<CourseDetail />} />
                  <Route path="/course/:courseId/management" element={<CourseManagement />} />
                  <Route path="/course/:courseId/manage-materials" element={<CourseManageMaterials />} />
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
                <Toaster />
                <WelcomeModal />
                <GoogleAnalytics />
                <SEOMetaTags />
              </div>
            </OnboardingProvider>
          </PageVisibilityProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
