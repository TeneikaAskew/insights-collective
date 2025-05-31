import React, { useEffect, useState } from 'react';
// import { QueryClient } from 'react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { PageVisibilityProvider } from '@/contexts/PageVisibilityContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Profile from '@/pages/Profile';
import NotFound from '@/pages/NotFound';
import ProtectedRoute from '@/components/ProtectedRoute';
import CareerPathway from '@/pages/CareerPathway';
import { portfolioRoutes } from './routes/PortfolioRoutes';
import CourseList from '@/pages/CourseList';
import Resources from '@/pages/Resources';
import PageVisibilityGuard from '@/components/PageVisibilityGuard';
import Resume from '@/pages/Resume';
import InterviewPrep from '@/pages/InterviewPrep';
import MockInterviews from '@/pages/interview-prep/MockInterviews';
import CodePractice from '@/pages/CodePractice';
import Events from '@/pages/Events';
import BlogList from '@/pages/BlogList';
import BlogPost from '@/pages/BlogPost';
import Messages from '@/pages/Messages';
import ForumList from '@/pages/ForumList';
import ForumDetail from '@/pages/ForumDetail';
import Assistants from '@/pages/Assistants';
import AssistantInterface from '@/pages/AssistantInterface';
import CareerAgent from '@/pages/CareerAgent';
import Calendar from '@/pages/Calendar';
import CourseDetail from '@/pages/CourseDetail';
import ModuleDetail from '@/pages/ModuleDetail';
import JobDescription from '@/pages/interview-prep/JobDescription';
import StarPractice from '@/pages/interview-prep/StarPractice';
import CodePracticeInterview from '@/pages/interview-prep/CodePractice';
import MockInterviewRoom from '@/pages/interview-prep/MockInterviewRoom';

import Survey from '@/pages/Survey';
import Notifications from '@/pages/Notifications';

// Additional missing imports
import AuthCallback from '@/pages/AuthCallback';
import CreateBlogPost from '@/pages/CreateBlogPost';
import EditBlogPost from '@/pages/EditBlogPost';
import ResetPassword from '@/pages/ResetPassword';
import ExploreDataCareers from '@/pages/ExploreDataCareers';
import UserDashboard from '@/pages/UserDashboard';
import ThreadDetail from '@/pages/ThreadDetail';
import CourseManagement from '@/pages/CourseManagement';
import CourseManageMaterials from '@/pages/CourseManageMaterials';
import DataBlueprintSeries from '@/pages/DataBlueprintSeries';
import SurveyConfirmation from '@/pages/SurveyConfirmation';

// Admin components
import AdminDashboard from '@/pages/AdminDashboard';
import AdminUsers from '@/pages/AdminUsers';
import AdminCourses from '@/pages/AdminCourses';
import AdminEvents from '@/pages/AdminEvents';
import AdminBlogPosts from '@/pages/AdminBlogPosts';

import AdminForms from '@/pages/AdminForms';
import AdminActivity from '@/pages/AdminActivity';


import AdminCourseEdit from '@/pages/AdminCourseEdit';
import AdminPageVisibility from '@/pages/AdminPageVisibility';
import AdminGuard from '@/components/admin/AdminGuard';

// Admin pages from admin folder
import FormManagement from '@/pages/admin/FormManagement';
import LocalStorageDebug from '@/pages/admin/LocalStorageDebug';
import UnifiedFormManagement from '@/pages/admin/UnifiedFormManagement';

// Survey pages
import SurveyFormCreate from '@/pages/survey/SurveyFormCreate';
import SurveyFormEdit from '@/pages/survey/SurveyFormEdit';
import SurveyPage from '@/pages/survey/SurveyPage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <Router>
          <AuthProvider>
            <OnboardingProvider>
              <PageVisibilityProvider>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  
                  {/* Blog routes - some public, some protected */}
                  <Route 
                    path="/blog" 
                    element={
                      <PageVisibilityGuard>
                        <BlogList />
                      </PageVisibilityGuard>
                    } 
                  />
                  <Route 
                    path="/blog/:postId" 
                    element={
                      <PageVisibilityGuard>
                        <BlogPost />
                      </PageVisibilityGuard>
                    } 
                  />
                  <Route
                    path="/blog/create"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <CreateBlogPost />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/blog/edit/:postId"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <EditBlogPost />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />

                  {/* Career exploration routes */}
                  <Route
                    path="/explore-data-careers"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <ExploreDataCareers />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />

                  {/* Dashboard routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <Dashboard />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user-dashboard"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <UserDashboard />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <Profile />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  <Route
                    path="/courses"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <CourseList />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  <Route
                    path="/courses/:courseId"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <CourseDetail />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />

                  {/* Course management routes */}
                  <Route
                    path="/course-management"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <CourseManagement />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/course/:courseId/manage-materials"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <CourseManageMaterials />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  <Route
                    path="/module/:moduleId"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <ModuleDetail />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  <Route
                    path="/career-pathway"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <CareerPathway />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />

                  {/* Data Blueprint routes */}
                  <Route
                    path="/data-blueprint"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <DataBlueprintSeries />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/data-blueprint-series"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <DataBlueprintSeries />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Survey routes */}
                  <Route
                    path="/survey"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <Survey />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/survey/confirmation"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <SurveyConfirmation />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/survey/create"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <SurveyFormCreate />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/survey/:surveySlug"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <SurveyPage />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/survey/:surveySlug/edit"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <SurveyFormEdit />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <Notifications />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Resources route */}
                  <Route
                    path="/resources"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <Resources />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Resume route */}
                  <Route
                    path="/resume"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <Resume />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Interview preparation routes - all properly guarded */}
                  <Route
                    path="/interview-prep"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <InterviewPrep />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/interview-prep/job-description"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <JobDescription />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/interview-prep/star-practice"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <StarPractice />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/interview-prep/code-practice"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <CodePracticeInterview />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/interview-prep/mock-interviews"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <MockInterviews />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/interview-prep/mock-interview-room/:sessionId"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <MockInterviewRoom />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/mock-interviews"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <MockInterviews />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/mock-interview/:sessionId"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <MockInterviewRoom />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/code-practice"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <CodePractice />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Events route */}
                  <Route
                    path="/events"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <Events />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Messaging routes */}
                  <Route
                    path="/messages"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <Messages />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/messages/:conversationId"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <Messages />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Forum routes */}
                  <Route
                    path="/forums"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <ForumList />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/forums/:forumId"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <ForumDetail />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/thread/:threadId"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <ThreadDetail />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Calendar route */}
                  <Route
                    path="/calendar"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <Calendar />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Assistant routes */}
                  <Route
                    path="/assistants"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <Assistants />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/assistant/:assistantId"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <AssistantInterface />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/career-agent"
                    element={
                      <ProtectedRoute>
                        <PageVisibilityGuard>
                          <CareerAgent />
                        </PageVisibilityGuard>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Admin routes - no need for PageVisibilityGuard because AdminGuard handles access */}
                  <Route
                    path="/admin"
                    element={
                      <AdminGuard>
                        <AdminDashboard />
                      </AdminGuard>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <AdminGuard>
                        <AdminUsers />
                      </AdminGuard>
                    }
                  />
                  <Route
                    path="/admin/courses"
                    element={
                      <AdminGuard>
                        <AdminCourses />
                      </AdminGuard>
                    }
                  />
                  <Route
                    path="/admin/events"
                    element={
                      <AdminGuard>
                        <AdminEvents />
                      </AdminGuard>
                    }
                  />
                  <Route
                    path="/admin/blog-posts"
                    element={
                      <AdminGuard>
                        <AdminBlogPosts />
                      </AdminGuard>
                    }
                  />
                  
                  <Route
                    path="/admin/forms"
                    element={
                      <AdminGuard>
                        <UnifiedFormManagement />
                      </AdminGuard>
                    }
                  />
                  <Route
                    path="/admin/legacy-forms"
                    element={
                      <AdminGuard>
                        <AdminForms />
                      </AdminGuard>
                    }
                  />
                  <Route
                    path="/admin/form-management"
                    element={
                      <AdminGuard>
                        <FormManagement />
                      </AdminGuard>
                    }
                  />
                  <Route
                    path="/admin/unified-form-management"
                    element={
                      <AdminGuard>
                        <UnifiedFormManagement />
                      </AdminGuard>
                    }
                  />
                  <Route
                    path="/admin/localstorage-debug"
                    element={
                      <AdminGuard>
                        <LocalStorageDebug />
                      </AdminGuard>
                    }
                  />
                  <Route
                    path="/admin/activity"
                    element={
                      <AdminGuard>
                        <AdminActivity />
                      </AdminGuard>
                    }
                  />
                  
                  
                  <Route
                    path="/admin/courses/:courseId/edit"
                    element={
                      <AdminGuard>
                        <AdminCourseEdit />
                      </AdminGuard>
                    }
                  />
                  <Route
                    path="/admin/page-visibility"
                    element={
                      <AdminGuard>
                        <AdminPageVisibility />
                      </AdminGuard>
                    }
                  />
                  
                  {/* Portfolio routes */}
                  {portfolioRoutes}
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Toaster />
              </PageVisibilityProvider>
            </OnboardingProvider>
          </AuthProvider>
        </Router>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

export default App;
