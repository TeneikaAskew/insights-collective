
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';

// Pages
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Profile from '@/pages/Profile';
import Courses from '@/pages/Courses';
import CourseDetail from '@/pages/CourseDetail';
import Events from '@/pages/Events';
import Messages from '@/pages/Messages';
import InterviewPrep from '@/pages/InterviewPrep';
import MockInterview from '@/pages/MockInterview';
import InterviewPractice from '@/pages/InterviewPractice';
import PortfolioExplorer from '@/pages/PortfolioExplorer';
import PublicPortfolio from '@/pages/PublicPortfolio';
import CareerPathway from '@/pages/CareerPathway';
import Careers from '@/pages/Careers';
import CareerRoleDetail from '@/pages/CareerRoleDetail';
import Resources from '@/pages/Resources';
import AI from '@/pages/AI';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import EventsAdmin from '@/pages/admin/EventsAdmin';
import BlogAdmin from '@/pages/admin/BlogAdmin';
import CourseAdmin from '@/pages/admin/CourseAdmin';
import FormsAdmin from '@/pages/admin/FormsAdmin';
import FormResponsesAdmin from '@/pages/admin/FormResponsesAdmin';
import UserManagement from '@/pages/admin/UserManagement';
import Blog from '@/pages/Blog';
import BlogPost from '@/pages/BlogPost';
import CodePractice from '@/pages/CodePractice';
import Forum from '@/pages/Forum';
import ThreadDetail from '@/pages/ThreadDetail';
import FormSubmission from '@/pages/FormSubmission';

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
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:id" element={<CourseDetail />} />
              <Route path="/events" element={<Events />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/interview-prep" element={<InterviewPrep />} />
              <Route path="/mock-interview" element={<MockInterview />} />
              <Route path="/interview-practice" element={<InterviewPractice />} />
              <Route path="/code-practice" element={<CodePractice />} />
              <Route path="/portfolio-explorer" element={<PortfolioExplorer />} />
              <Route path="/portfolio/:customUrl" element={<PublicPortfolio />} />
              <Route path="/career-pathway" element={<CareerPathway />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/careers/:slug" element={<CareerRoleDetail />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/data-blueprint-series" element={<Navigate to="/blog" replace />} />
              <Route path="/ai" element={<AI />} />
              <Route path="/forum" element={<Forum />} />
              <Route path="/forum/:courseId" element={<Forum />} />
              <Route path="/thread/:threadId" element={<ThreadDetail />} />
              <Route path="/forms/:formId" element={<FormSubmission />} />

              {/* Admin Routes */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/events" element={<EventsAdmin />} />
              <Route path="/admin/blog/*" element={<BlogAdmin />} />
              <Route path="/admin/courses" element={<CourseAdmin />} />
              <Route path="/admin/forms" element={<FormsAdmin />} />
              <Route path="/admin/forms/:formId/responses" element={<FormResponsesAdmin />} />
              <Route path="/admin/users" element={<UserManagement />} />
            </Routes>
            <Toaster />
            <WelcomeModal />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
