
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import WelcomeModal from '@/components/onboarding/WelcomeModal';

// Pages that exist
import Login from '@/pages/Login';
import Profile from '@/pages/Profile';
import CourseDetail from '@/pages/CourseDetail';
import Events from '@/pages/Events';
import Messages from '@/pages/Messages';
import InterviewPrep from '@/pages/InterviewPrep';
import PortfolioExplorer from '@/pages/PortfolioExplorer';
import CareerPathway from '@/pages/CareerPathway';
import Resources from '@/pages/Resources';
import AdminDashboard from '@/pages/AdminDashboard';
import BlogAdmin from '@/pages/admin/BlogAdmin';
import Blog from '@/pages/Blog';
import BlogPost from '@/pages/BlogPost';
import CodePractice from '@/pages/CodePractice';
import Forum from '@/pages/ForumList';
import ThreadDetail from '@/pages/ThreadDetail';

// Use Dashboard as the home page since Index exists
import Dashboard from '@/pages/Dashboard';

import '@/App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/courses" element={<Navigate to="/dashboard" replace />} />
              <Route path="/courses/:id" element={<CourseDetail />} />
              <Route path="/events" element={<Events />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/interview-prep" element={<InterviewPrep />} />
              <Route path="/code-practice" element={<CodePractice />} />
              <Route path="/portfolio-explorer" element={<PortfolioExplorer />} />
              <Route path="/career-pathway" element={<CareerPathway />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/data-blueprint-series" element={<Navigate to="/blog" replace />} />
              <Route path="/forum" element={<Forum />} />
              <Route path="/thread/:threadId" element={<ThreadDetail />} />

              {/* Admin Routes */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/blog/*" element={<BlogAdmin />} />
            </Routes>
            <Toaster />
            <WelcomeModal />
          </div>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
