
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

// Pages
import Index from '@/pages/Index';
import Dashboard from '@/pages/Dashboard';
import UserDashboard from '@/pages/UserDashboard';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import NotFound from '@/pages/NotFound';
import Profile from '@/pages/Profile';
import Resources from '@/pages/Resources';
import CourseList from '@/pages/CourseList';
import CourseDetail from '@/pages/CourseDetail';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminCourses from '@/pages/AdminCourses';
import AdminUsers from '@/pages/AdminUsers';
import ModuleDetail from '@/pages/ModuleDetail';
import AdminCourseEdit from '@/pages/AdminCourseEdit';
import CourseManagement from '@/pages/CourseManagement';
import CourseManageMaterials from '@/pages/CourseManageMaterials';
import AdminEnrollments from '@/pages/AdminEnrollments';
import Events from '@/pages/Events';
import AdminEvents from '@/pages/AdminEvents';
import AdminResources from '@/pages/AdminResources';
import Resume from '@/pages/Resume';
import AdminForms from '@/pages/AdminForms';
import FormManagement from '@/pages/admin/FormManagement';
import UnifiedFormManagement from '@/pages/admin/UnifiedFormManagement';
import AdminPageVisibility from '@/pages/AdminPageVisibility';
import Messages from '@/pages/Messages';
import Calendar from '@/pages/Calendar';
import Notifications from '@/pages/Notifications';
import AdminActivity from '@/pages/AdminActivity';
import AdminCertificates from '@/pages/AdminCertificates';
import ForumList from '@/pages/ForumList';
import ForumDetail from '@/pages/ForumDetail';
import ThreadDetail from '@/pages/ThreadDetail';
import DataBlueprintSeries from '@/pages/DataBlueprintSeries';
import SurveyPage from '@/pages/survey/SurveyPage';
import AuthCallback from '@/pages/AuthCallback';
import CareerPathway from '@/pages/CareerPathway';
import ExploreDataCareers from '@/pages/ExploreDataCareers';
import SurveyConfirmation from '@/pages/SurveyConfirmation';
import PortfolioExplorer from '@/pages/PortfolioExplorer';
import SurveyFormCreate from '@/pages/survey/SurveyFormCreate';
import SurveyFormEdit from '@/pages/survey/SurveyFormEdit';
import BlogPost from '@/pages/BlogPost';
import BlogList from '@/pages/BlogList';
import CreateBlogPost from '@/pages/CreateBlogPost';
import EditBlogPost from '@/pages/EditBlogPost';
import AdminBlogPosts from '@/pages/AdminBlogPosts';
import CareerAgent from '@/pages/CareerAgent';
import AssistantInterface from '@/pages/AssistantInterface';
import Assistants from '@/pages/Assistants';
import LocalStorageDebug from '@/pages/admin/LocalStorageDebug';

// Interview Preparation Pages
import InterviewPrep from '@/pages/InterviewPrep';
import JobDescriptionDetail from '@/pages/JobDescriptionDetail';
import StudyGuideDetail from '@/pages/StudyGuideDetail';

import './App.css';
import { Toaster } from '@/components/ui/toaster';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import PageVisibilityGuard from '@/components/PageVisibilityGuard';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <Router>
          <Helmet titleTemplate="%s | Insights Collective" defaultTitle="Insights Collective" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Index />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="user-dashboard" element={
                <ProtectedRoute>
                  <UserDashboard />
                </ProtectedRoute>
              } />
              <Route path="profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="resources" element={<Resources />} />
              <Route path="courses" element={<CourseList />} />
              <Route path="courses/:id" element={<CourseDetail />} />
              <Route path="courses/:courseId/module/:moduleId" element={<ModuleDetail />} />
              <Route path="course-management/:id" element={
                <ProtectedRoute>
                  <CourseManagement />
                </ProtectedRoute>
              } />
              <Route path="course-management/:courseId/module/:moduleId/materials" element={
                <ProtectedRoute>
                  <CourseManageMaterials />
                </ProtectedRoute>
              } />
              <Route path="events" element={<PageVisibilityGuard><Events /></PageVisibilityGuard>} />
              <Route path="resume" element={<PageVisibilityGuard><Resume /></PageVisibilityGuard>} />
              <Route path="messages" element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              } />
              <Route path="messages/:conversationId" element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              } />
              <Route path="calendar" element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              } />
              <Route path="notifications" element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              } />
              <Route path="forums" element={<ForumList />} />
              <Route path="forums/:id" element={<ForumDetail />} />
              <Route path="threads/:id" element={<ThreadDetail />} />
              <Route path="data-blueprint" element={<DataBlueprintSeries />} />
              <Route path="survey" element={<SurveyPage />} />
              <Route path="survey-confirmation" element={<SurveyConfirmation />} />
              <Route path="career-pathway" element={<CareerPathway />} />
              <Route path="explore-data-careers" element={<ExploreDataCareers />} />
              <Route path="portfolio-explorer" element={<PortfolioExplorer />} />
              <Route path="blog" element={<BlogList />} />
              <Route path="blog/:slug" element={<BlogPost />} />
              <Route path="career-agent" element={<CareerAgent />} />
              <Route path="assistants" element={<Assistants />} />
              <Route path="assistant/:id" element={<AssistantInterface />} />
              
              {/* Interview Preparation Routes */}
              <Route path="interview" element={<InterviewPrep />} />
              <Route path="interview/job/:id" element={<JobDescriptionDetail />} />
              <Route path="interview/study/:id" element={<StudyGuideDetail />} />
              
              {/* Admin Routes */}
              <Route path="admin" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="admin/activity" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminActivity />
                </ProtectedRoute>
              } />
              <Route path="admin/courses" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminCourses />
                </ProtectedRoute>
              } />
              <Route path="admin/courses/:id" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminCourseEdit />
                </ProtectedRoute>
              } />
              <Route path="admin/users" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminUsers />
                </ProtectedRoute>
              } />
              <Route path="admin/enrollments" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminEnrollments />
                </ProtectedRoute>
              } />
              <Route path="admin/events" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminEvents />
                </ProtectedRoute>
              } />
              <Route path="admin/resources" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminResources />
                </ProtectedRoute>
              } />
              <Route path="admin/certificates" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminCertificates />
                </ProtectedRoute>
              } />
              <Route path="admin/forms" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminForms />
                </ProtectedRoute>
              } />
              <Route path="admin/forms/:id" element={
                <ProtectedRoute requiredRole="admin">
                  <FormManagement />
                </ProtectedRoute>
              } />
              <Route path="admin/forms/:id/unified" element={
                <ProtectedRoute requiredRole="admin">
                  <UnifiedFormManagement />
                </ProtectedRoute>
              } />
              <Route path="admin/page-visibility" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPageVisibility />
                </ProtectedRoute>
              } />
              <Route path="admin/blog" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminBlogPosts />
                </ProtectedRoute>
              } />
              <Route path="admin/blog/create" element={
                <ProtectedRoute requiredRole="admin">
                  <CreateBlogPost />
                </ProtectedRoute>
              } />
              <Route path="admin/blog/edit/:id" element={
                <ProtectedRoute requiredRole="admin">
                  <EditBlogPost />
                </ProtectedRoute>
              } />
              <Route path="admin/survey/create" element={
                <ProtectedRoute requiredRole="admin">
                  <SurveyFormCreate />
                </ProtectedRoute>
              } />
              <Route path="admin/survey/edit/:id" element={
                <ProtectedRoute requiredRole="admin">
                  <SurveyFormEdit />
                </ProtectedRoute>
              } />
              <Route path="admin/debug" element={
                <ProtectedRoute requiredRole="admin">
                  <LocalStorageDebug />
                </ProtectedRoute>
              } />
              
              {/* Not Found */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <Toaster />
        </Router>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

export default App;
