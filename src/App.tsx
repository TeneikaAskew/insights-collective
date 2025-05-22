
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { PageVisibilityProvider } from '@/contexts/PageVisibilityContext';
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

// Admin components
import AdminDashboard from '@/pages/AdminDashboard';
import AdminUsers from '@/pages/AdminUsers';
import AdminCourses from '@/pages/AdminCourses';
import AdminEvents from '@/pages/AdminEvents';
import AdminBlogPosts from '@/pages/AdminBlogPosts';
import AdminResources from '@/pages/AdminResources';
import AdminForms from '@/pages/AdminForms';
import AdminActivity from '@/pages/AdminActivity';
import AdminCertificates from '@/pages/AdminCertificates';
import AdminEnrollments from '@/pages/AdminEnrollments';
import AdminCourseEdit from '@/pages/AdminCourseEdit';
import AdminPageVisibility from '@/pages/AdminPageVisibility';
import AdminGuard from '@/components/admin/AdminGuard';

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
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses"
                element={
                  <ProtectedRoute>
                    <CourseList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/course/:courseId"
                element={
                  <ProtectedRoute>
                    <CourseDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/module/:moduleId"
                element={
                  <ProtectedRoute>
                    <ModuleDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/career-pathway"
                element={
                  <ProtectedRoute>
                    <CareerPathway />
                  </ProtectedRoute>
                }
              />
              
              {/* Resources route */}
              <Route
                path="/resources"
                element={
                  <PageVisibilityGuard>
                    <Resources />
                  </PageVisibilityGuard>
                }
              />
              
              {/* Resume route */}
              <Route
                path="/resume"
                element={
                  <ProtectedRoute>
                    <Resume />
                  </ProtectedRoute>
                }
              />
              
              {/* Interview preparation routes */}
              <Route
                path="/interview-prep"
                element={
                  <ProtectedRoute>
                    <InterviewPrep />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interview-prep/job-description"
                element={
                  <ProtectedRoute>
                    <JobDescription />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interview-prep/star-practice"
                element={
                  <ProtectedRoute>
                    <StarPractice />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interview-prep/code-practice"
                element={
                  <ProtectedRoute>
                    <CodePracticeInterview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interview-prep/mock-interviews"
                element={
                  <ProtectedRoute>
                    <MockInterviews />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interview-prep/mock-interview-room/:sessionId"
                element={
                  <ProtectedRoute>
                    <MockInterviewRoom />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mock-interviews"
                element={
                  <ProtectedRoute>
                    <MockInterviews />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mock-interview/:sessionId"
                element={
                  <ProtectedRoute>
                    <MockInterviewRoom />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/code-practice"
                element={
                  <ProtectedRoute>
                    <CodePractice />
                  </ProtectedRoute>
                }
              />
              
              {/* Events route */}
              <Route
                path="/events"
                element={
                  <ProtectedRoute>
                    <Events />
                  </ProtectedRoute>
                }
              />
              
              {/* Blog routes */}
              <Route path="/blog" element={<BlogList />} />
              <Route path="/blog/:postId" element={<BlogPost />} />
              
              {/* Messaging routes */}
              <Route
                path="/messages"
                element={
                  <ProtectedRoute>
                    <Messages />
                  </ProtectedRoute>
                }
              />
              
              {/* Forum routes */}
              <Route
                path="/forums"
                element={
                  <ProtectedRoute>
                    <ForumList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/forums/:forumId"
                element={
                  <ProtectedRoute>
                    <ForumDetail />
                  </ProtectedRoute>
                }
              />
              
              {/* Calendar route */}
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <Calendar />
                  </ProtectedRoute>
                }
              />
              
              {/* Assistant routes */}
              <Route
                path="/assistants"
                element={
                  <ProtectedRoute>
                    <Assistants />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assistant/:assistantId"
                element={
                  <ProtectedRoute>
                    <AssistantInterface />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/career-agent"
                element={
                  <ProtectedRoute>
                    <CareerAgent />
                  </ProtectedRoute>
                }
              />
              
              {/* Admin routes */}
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
                path="/admin/resources"
                element={
                  <AdminGuard>
                    <AdminResources />
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/forms"
                element={
                  <AdminGuard>
                    <AdminForms />
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
                path="/admin/certificates"
                element={
                  <AdminGuard>
                    <AdminCertificates />
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/enrollments"
                element={
                  <AdminGuard>
                    <AdminEnrollments />
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/course/:courseId/edit"
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
            <PageVisibilityProvider>
              <Toaster />
            </PageVisibilityProvider>
          </AuthProvider>
        </Router>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

export default App;
