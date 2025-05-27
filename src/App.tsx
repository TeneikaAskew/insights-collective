
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import Index from '@/pages/Index';
import Resources from '@/pages/Resources';
import CareerAgent from '@/pages/CareerAgent';
import CareerPathway from '@/pages/CareerPathway';
import PortfolioExplorer from '@/pages/PortfolioExplorer';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Profile from '@/pages/Profile';
import UserDashboard from '@/pages/UserDashboard';
import AdminDashboard from '@/pages/AdminDashboard';
import InterviewPrep from '@/pages/InterviewPrep';
import CodePractice from '@/pages/interview-prep/CodePractice';
import StarPractice from '@/pages/interview-prep/StarPractice';
import JobDescription from '@/pages/interview-prep/JobDescription';
import MockInterviews from '@/pages/interview-prep/MockInterviews';
import ExploreDataCareers from '@/pages/ExploreDataCareers';
import NotFound from '@/pages/NotFound';
import { Toaster } from '@/components/ui/toaster';
import { OnboardingProvider } from '@/contexts/OnboardingContext';

const queryClient = new QueryClient();

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OnboardingProvider>
            <Router>
              <div className="min-h-screen bg-background">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/career-agent" element={<CareerAgent />} />
                  <Route path="/career-pathway" element={<CareerPathway />} />
                  <Route path="/portfolio-explorer" element={<PortfolioExplorer />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/user-dashboard" element={<UserDashboard />} />
                  <Route path="/admin-dashboard" element={<AdminDashboard />} />
                  <Route path="/interview-prep" element={<InterviewPrep />} />
                  <Route path="/interview-prep/code-practice" element={<CodePractice />} />
                  <Route path="/interview-prep/star-practice" element={<StarPractice />} />
                  <Route path="/interview-prep/job-description" element={<JobDescription />} />
                  <Route path="/interview-prep/mock-interviews" element={<MockInterviews />} />
                  <Route path="/explore-data-careers" element={<ExploreDataCareers />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Toaster />
              </div>
            </Router>
          </OnboardingProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
