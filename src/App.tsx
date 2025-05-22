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
import Courses from '@/pages/Courses';
import CourseDetail from '@/pages/CourseDetail';
import CoursePlayer from '@/pages/CoursePlayer';
import Messages from '@/pages/Messages';
import Conversation from '@/pages/Conversation';
import NotFound from '@/pages/NotFound';
import ProtectedRoute from '@/components/ProtectedRoute';
import ResumeAnalyzer from '@/pages/ResumeAnalyzer';
import JobMatchAnalyzer from '@/pages/JobMatchAnalyzer';
import CareerPathway from '@/pages/CareerPathway';
import StudyGuide from '@/pages/StudyGuide';
import StarMethod from '@/pages/StarMethod';
import { portfolioRoutes } from './routes/PortfolioRoutes';

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
        <AuthProvider>
          <Router>
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
                    <Courses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses/:courseId"
                element={
                  <ProtectedRoute>
                    <CourseDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses/:courseId/learn"
                element={
                  <ProtectedRoute>
                    <CoursePlayer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messages"
                element={
                  <ProtectedRoute>
                    <Messages />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messages/:conversationId"
                element={
                  <ProtectedRoute>
                    <Conversation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resume-analyzer"
                element={
                  <ProtectedRoute>
                    <ResumeAnalyzer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/job-match"
                element={
                  <ProtectedRoute>
                    <JobMatchAnalyzer />
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
              <Route
                path="/study-guide"
                element={
                  <ProtectedRoute>
                    <StudyGuide />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/star-method"
                element={
                  <ProtectedRoute>
                    <StarMethod />
                  </ProtectedRoute>
                }
              />
              
              {/* Portfolio routes */}
              {portfolioRoutes}
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
          <PageVisibilityProvider>
            <Toaster />
          </PageVisibilityProvider>
        </AuthProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

export default App;
