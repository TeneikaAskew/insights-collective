
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
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
import PageVisibility from '@/pages/admin/PageVisibility';
import Blog from '@/pages/Blog';
import BlogPost from '@/pages/BlogPost';
import CodePractice from '@/pages/CodePractice';
import Forum from '@/pages/ForumList';
import ThreadDetail from '@/pages/ThreadDetail';

// Portfolio related imports
import { EnhancedPortfolioEditor } from '@/components/portfolio/EnhancedPortfolioEditor';
import { PublicPortfolioView } from '@/components/portfolio/PublicPortfolioView';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { Spinner } from '@/components/ui/spinner';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageVisibilityGuard from '@/components/PageVisibilityGuard';

// Import Index as the home page and Dashboard as authenticated page
import Index from '@/pages/Index';
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <OnboardingProvider>
            <div className="min-h-screen bg-gray-50">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/courses" element={<Navigate to="/dashboard" replace />} />
                <Route path="/courses/:id" element={<CourseDetail />} />
                <Route path="/events" element={<Events />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/interview-prep" element={<InterviewPrep />} />
                <Route path="/code-practice" element={<CodePractice />} />
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
                <Route path="/admin/page-visibility" element={<PageVisibility />} />
              </Routes>
              <Toaster />
              <WelcomeModal />
            </div>
          </OnboardingProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
