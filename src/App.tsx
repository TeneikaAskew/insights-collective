import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import { PageVisibilityProvider } from "./contexts/PageVisibilityContext";
import { ToastProvider } from "@/components/ui/toast";

// Import page components
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CourseList from "./pages/CourseList";
import CourseDetail from "./pages/CourseDetail";
import ModuleDetail from "./pages/ModuleDetail";
import Resources from "./pages/Resources";
import DataBlueprintSeries from "./pages/DataBlueprintSeries";
import BlogList from "./pages/BlogList";
import BlogPost from "./pages/BlogPost";
import Events from "./pages/Events";
import Notifications from "./pages/Notifications";
import ExploreDataCareers from "./pages/ExploreDataCareers";
import Profile from "./pages/Profile";
import Calendar from "./pages/Calendar";
import Assistants from "./pages/Assistants";
import AssistantInterface from "./pages/AssistantInterface";
import Messages from "./pages/Messages";
import Resume from "./pages/Resume";
import NotFound from "./pages/NotFound";
import CareerPathway from "./pages/CareerPathway";
import SurveyConfirmation from "./pages/SurveyConfirmation";
import AuthCallback from "./pages/AuthCallback";

// Import admin pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminActivity from "./pages/AdminActivity";
import AdminUsers from "./pages/AdminUsers";
import AdminEnrollments from "./pages/AdminEnrollments";
import AdminCertificates from "./pages/AdminCertificates";
import AdminResources from "./pages/AdminResources";
import AdminEvents from "./pages/AdminEvents";
import AdminBlogPosts from "./pages/AdminBlogPosts";
import CreateBlogPost from './pages/CreateBlogPost';
import EditBlogPost from './pages/EditBlogPost';
import AdminPageVisibility from "./pages/AdminPageVisibility";
import AdminForms from "./pages/AdminForms";

// Import guards and layout components
import ProtectedRoute from "./components/ProtectedRoute";
import PageVisibilityGuard from "./components/PageVisibilityGuard";
import LocalStorageDebug from "./components/LocalStorageDebug";

// Import course management components
import CourseManagement from './pages/CourseManagement';
import CourseManagementDashboard from '@/components/course/management/CourseManagementDashboard';
import CourseEditor from '@/components/course/management/CourseEditor';
import CourseManageMaterials from './pages/CourseManageMaterials';

// Import forum components
import ForumList from './pages/ForumList';
import ForumDetail from './pages/ForumDetail';
import ThreadDetail from './pages/ThreadDetail';

// Import the AdminCourseEdit component
import AdminCourseEdit from "./pages/AdminCourseEdit";
import CareerAgent from "./pages/CareerAgent";

// Import survey pages
import SurveyPage from "./pages/survey/SurveyPage";
import SurveyFormEdit from "./pages/survey/SurveyFormEdit";
import SurveyFormCreate from "./pages/survey/SurveyFormCreate";
import UnifiedFormManagement from "./pages/admin/UnifiedFormManagement";
import FormManagement from "./pages/admin/FormManagement";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Helper component to apply both ProtectedRoute and PageVisibilityGuard
const ProtectedVisibleRoute = ({ children, requireAdmin = false }) => (
  <ProtectedRoute requireAdmin={requireAdmin}>
    <PageVisibilityGuard>{children}</PageVisibilityGuard>
  </ProtectedRoute>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <TooltipProvider>
            <AuthProvider>
              <PageVisibilityProvider>
                <Toaster />
                <Sonner />
                <Routes>
                  {/* Public routes - no auth required */}
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/career-agent" element={<CareerAgent />} />
                  <Route path="/career-pathway" element={<CareerPathway />} />
                  <Route path="/blog" element={<BlogList />} />
                  <Route path="/blog/:slug" element={<BlogPost />} />
                  <Route path="/explore-data-careers" element={<ExploreDataCareers />} />
                  <Route path="/courses" element={<CourseList />} />
                  <Route path="/courses/:courseId" element={<CourseDetail />} />
                  <Route path="/data-blueprint" element={<DataBlueprintSeries />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/forums" element={<ForumList />} />
                  <Route path="/survey-confirmation" element={<SurveyConfirmation />} />
                  <Route path="/survey-confirmation/:slug" element={<SurveyConfirmation />} />
                  <Route path="/survey/:slug" element={<SurveyPage />} />
                  
                  {/* Protected form routes - need special handling for correct redirect flow */}
                  <Route path="/survey/:slug/edit" element={<ProtectedRoute requireAdmin={true}><SurveyFormEdit /></ProtectedRoute>} />
                  
                  {/* Form routes */}
                  <Route path="/admin/forms" element={<ProtectedVisibleRoute requireAdmin><UnifiedFormManagement /></ProtectedVisibleRoute>} />
                  <Route path="/admin/forms/submissions/:slug" element={<ProtectedVisibleRoute requireAdmin><FormManagement /></ProtectedVisibleRoute>} />
                  <Route path="/admin/forms/submissions/:slug/submission/:submissionId" element={<ProtectedVisibleRoute requireAdmin><FormManagement /></ProtectedVisibleRoute>} />
                  <Route path="/admin/form-management/*" element={<ProtectedVisibleRoute requireAdmin><FormManagement /></ProtectedVisibleRoute>} />
                  
                  {/* Protected routes - require authentication */}
                  <Route path="/dashboard" element={<ProtectedVisibleRoute><Dashboard /></ProtectedVisibleRoute>} />
                  <Route path="/courses/:courseId/modules/:moduleId" element={<ProtectedVisibleRoute><ModuleDetail /></ProtectedVisibleRoute>} />
                  <Route path="/resources" element={<ProtectedVisibleRoute><Resources /></ProtectedVisibleRoute>} />
                  <Route path="/notifications" element={<ProtectedVisibleRoute><Notifications /></ProtectedVisibleRoute>} />
                  <Route path="/profile" element={<ProtectedVisibleRoute><Profile /></ProtectedVisibleRoute>} />
                  <Route path="/calendar" element={<ProtectedVisibleRoute><Calendar /></ProtectedVisibleRoute>} />
                  <Route path="/assistants" element={<ProtectedVisibleRoute><Assistants /></ProtectedVisibleRoute>} />
                  <Route path="/assistant/:assistantId?" element={<ProtectedVisibleRoute><AssistantInterface /></ProtectedVisibleRoute>} />
                  <Route path="/messages" element={<ProtectedVisibleRoute><Messages /></ProtectedVisibleRoute>} />
                  <Route path="/messages/:conversationId?" element={<ProtectedVisibleRoute><Messages /></ProtectedVisibleRoute>} />
                  <Route path="/resume" element={<ProtectedVisibleRoute><Resume /></ProtectedVisibleRoute>} />
                  
                  {/* Forum routes - require authentication */}
                  <Route path="/courses/:courseId/forums" element={<ProtectedVisibleRoute><ForumList /></ProtectedVisibleRoute>} />
                  <Route path="/courses/:courseId/forums/:forumId" element={<ProtectedVisibleRoute><ForumDetail /></ProtectedVisibleRoute>} />
                  <Route path="/courses/:courseId/forums/:forumId/threads/:threadId" element={<ProtectedVisibleRoute><ThreadDetail /></ProtectedVisibleRoute>} />
                  
                  {/* Admin routes */}
                  <Route path="/admin" element={<ProtectedVisibleRoute requireAdmin><AdminDashboard /></ProtectedVisibleRoute>} />
                  <Route path="/admin/activity" element={<ProtectedVisibleRoute requireAdmin><AdminActivity /></ProtectedVisibleRoute>} />
                  <Route path="/admin/courses" element={<ProtectedVisibleRoute requireAdmin><CourseManagementDashboard /></ProtectedVisibleRoute>} />
                  <Route path="/admin/courses/:courseId/edit" element={<ProtectedVisibleRoute requireAdmin><CourseManagement /></ProtectedVisibleRoute>} />
                  <Route path="/admin/courses/new" element={<ProtectedVisibleRoute requireAdmin><AdminCourseEdit /></ProtectedVisibleRoute>} />
                  <Route path="/courses/:courseId/materials" element={<ProtectedVisibleRoute><CourseManageMaterials /></ProtectedVisibleRoute>} />
                  <Route path="/admin/users" element={<ProtectedVisibleRoute requireAdmin><AdminUsers /></ProtectedVisibleRoute>} />
                  <Route path="/admin/enrollments" element={<ProtectedVisibleRoute requireAdmin><AdminEnrollments /></ProtectedVisibleRoute>} />
                  <Route path="/admin/certificates" element={<ProtectedVisibleRoute requireAdmin><AdminCertificates /></ProtectedVisibleRoute>} />
                  <Route path="/admin/resources" element={<ProtectedVisibleRoute requireAdmin><AdminResources /></ProtectedVisibleRoute>} />
                  <Route path="/admin/events" element={<ProtectedVisibleRoute requireAdmin><AdminEvents /></ProtectedVisibleRoute>} />
                  <Route path="/admin/blog" element={<ProtectedVisibleRoute requireAdmin><AdminBlogPosts /></ProtectedVisibleRoute>} />
                  <Route path="/admin/blog/create" element={<ProtectedVisibleRoute requireAdmin><CreateBlogPost /></ProtectedVisibleRoute>} />
                  <Route path="/admin/blog/edit/:slug" element={<ProtectedVisibleRoute requireAdmin><EditBlogPost /></ProtectedVisibleRoute>} />
                  <Route path="/admin/page-visibility" element={<ProtectedVisibleRoute requireAdmin><AdminPageVisibility /></ProtectedVisibleRoute>} />
                  <Route path="/components/LocalStorageDebug.tsx" element={<ProtectedVisibleRoute requireAdmin><LocalStorageDebug /></ProtectedVisibleRoute>} />
                  <Route path="/admin/forms" element={<ProtectedVisibleRoute requireAdmin><UnifiedFormManagement /></ProtectedVisibleRoute>} />

                  {/* Legacy redirects */}
                  <Route path="/resources/data-blueprint" element={<Navigate to="/data-blueprint" replace />} />
                  <Route path="/resources/data-blueprint/:slug" element={<Navigate to="/blog/:slug" replace />} />

                  {/* Redirect old survey route to new form page */}
                  <Route path="/survey" element={<Navigate to="/survey/ai-fellowship" replace />} />

                  {/* Redirect old admin survey routes to new admin forms */}
                  <Route path="/survey/create" element={<Navigate to="/admin/forms" replace />} />
                  {/* Instead of redirecting to /admin/forms, leave this route to be protected by the ProtectedRoute above */}
                  {/* <Route path="/survey/:slug/edit" element={<Navigate to="/admin/forms" replace />} /> */}
                  <Route path="/survey/:slug/submissions" element={<Navigate to="/admin/forms/submissions/:slug" replace />} />

                  {/* Catch all NotFound */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </PageVisibilityProvider>
            </AuthProvider>
          </TooltipProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
