
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
import MockInterviews from '@/pages/MockInterviews';
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
                path="/interview-prep/mock-interview-room/:roomId"
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
