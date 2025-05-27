
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import Index from '@/pages/Index';
import Resources from '@/pages/Resources';
import { Login, Register } from '@/pages/auth';
import { Dashboard, UserDashboard, Profile, Notifications } from '@/pages/user';
import { CareerAgent, CareerPathway, ExploreDataCareers, Resume, InterviewPrep } from '@/pages/career';
import { CourseList, CourseDetail, Events, DataBlueprint } from '@/pages/learning';
import { Messages, ForumList, ForumDetail, ThreadDetail, Assistants } from '@/pages/communication';
import { PortfolioExplorer } from '@/pages/portfolio';
import { AdminDashboard, UnifiedFormManagement, FormManagement } from '@/pages/admin';
import { Survey, SurveyConfirmation, SurveyFormCreate } from '@/pages/survey';
import CodePractice from '@/pages/interview-prep/CodePractice';
import StarPractice from '@/pages/interview-prep/StarPractice';
import JobDescription from '@/pages/interview-prep/JobDescription';
import MockInterviews from '@/pages/interview-prep/MockInterviews';
import AdminActivity from '@/pages/AdminActivity';
import AdminCertificates from '@/pages/AdminCertificates';
import AdminEnrollments from '@/pages/AdminEnrollments';
import AdminForms from '@/pages/AdminForms';
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
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/user-dashboard" element={<UserDashboard />} />
                  <Route path="/admin-dashboard" element={<AdminDashboard />} />
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/career-agent" element={<CareerAgent />} />
                  <Route path="/career-pathway" element={<CareerPathway />} />
                  <Route path="/portfolio-explorer" element={<PortfolioExplorer />} />
                  <Route path="/courses" element={<CourseList />} />
                  <Route path="/courses/:id" element={<CourseDetail />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/forums" element={<ForumList />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/assistants" element={<Assistants />} />
                  <Route path="/data-blueprint" element={<DataBlueprint />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/interview-prep" element={<InterviewPrep />} />
                  <Route path="/interview-prep/code-practice" element={<CodePractice />} />
                  <Route path="/interview-prep/star-practice" element={<StarPractice />} />
                  <Route path="/interview-prep/job-description" element={<JobDescription />} />
                  <Route path="/interview-prep/mock-interviews" element={<MockInterviews />} />
                  <Route path="/explore-data-careers" element={<ExploreDataCareers />} />
                  <Route path="/resume" element={<Resume />} />
                  <Route path="/survey" element={<Survey />} />
                  <Route path="/survey/:slug" element={<Survey />} />
                  <Route path="/survey/:slug/confirmation" element={<SurveyConfirmation />} />
                  <Route path="/survey/create" element={<SurveyFormCreate />} />
                  <Route path="/admin/forms" element={<AdminForms />} />
                  <Route path="/admin/forms/unified" element={<UnifiedFormManagement />} />
                  <Route path="/admin/forms/submissions/:slug" element={<FormManagement />} />
                  <Route path="/admin/activity" element={<AdminActivity />} />
                  <Route path="/admin/certificates" element={<AdminCertificates />} />
                  <Route path="/admin/enrollments" element={<AdminEnrollments />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/courses/:courseId/forums/:forumId/threads/:threadId" element={<ThreadDetail />} />
                  <Route path="/courses/:courseId/forums/:forumId" element={<ForumDetail />} />
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
