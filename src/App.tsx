
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PageVisibilityProvider } from "./contexts/PageVisibilityContext";
import { ToastProvider } from "@/hooks/use-toast";
import React from "react";

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

// Import admin pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminActivity from "./pages/AdminActivity";
import AdminCourses from "./pages/AdminCourses";
import AdminUsers from "./pages/AdminUsers";
import AdminEnrollments from "./pages/AdminEnrollments";
import AdminCertificates from "./pages/AdminCertificates";
import AdminResources from "./pages/AdminResources";
import AdminEvents from "./pages/AdminEvents";
import AdminBlogPosts from "./pages/AdminBlogPosts";
import CreateBlogPost from "./pages/CreateBlogPost";
import AdminPageVisibility from "./pages/AdminPageVisibility";

// Import guards and layout components
import ProtectedRoute from "./components/ProtectedRoute";
import PageVisibilityGuard from "./components/PageVisibilityGuard";
import LocalStorageDebug from "./components/LocalStorageDebug";

// Import course management components
import CourseManagementDashboard from '@/components/course/management/CourseManagementDashboard';
import CourseEditor from '@/components/course/management/CourseEditor';
import CourseManageMaterials from './pages/CourseManageMaterials';

// Import the new AdminCourseEdit component
import AdminCourseEdit from "./pages/AdminCourseEdit";
import CareerAgent from "./pages/CareerAgent";

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
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <TooltipProvider>
              <AuthProvider>
                <PageVisibilityProvider>
                  <Toaster />
                  <Sonner />
                  <Routes>
                    {/* Public routes - no visibility guard needed */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/career-agent" element={<CareerAgent />} />
                    <Route path="/career-pathway" element={<CareerPathway />} />

                    {/* Protected public routes with visibility checks */}
                    <Route path="/" element={<ProtectedVisibleRoute><Index /></ProtectedVisibleRoute>} />
                    <Route path="/dashboard" element={<ProtectedVisibleRoute><Dashboard /></ProtectedVisibleRoute>} />
                    <Route path="/courses" element={<ProtectedVisibleRoute><CourseList /></ProtectedVisibleRoute>} />
                    <Route path="/courses/:courseId" element={<ProtectedVisibleRoute><CourseDetail /></ProtectedVisibleRoute>} />
                    <Route path="/courses/:courseId/modules/:moduleId" element={<ProtectedVisibleRoute><ModuleDetail /></ProtectedVisibleRoute>} />
                    <Route path="/resources" element={<ProtectedVisibleRoute><Resources /></ProtectedVisibleRoute>} />
                    <Route path="/data-blueprint" element={<ProtectedVisibleRoute><DataBlueprintSeries /></ProtectedVisibleRoute>} />
                    <Route path="/blog" element={<ProtectedVisibleRoute><BlogList /></ProtectedVisibleRoute>} />
                    <Route path="/blog/:slug" element={<ProtectedVisibleRoute><BlogPost /></ProtectedVisibleRoute>} />
                    <Route path="/events" element={<ProtectedVisibleRoute><Events /></ProtectedVisibleRoute>} />
                    <Route path="/notifications" element={<ProtectedVisibleRoute><Notifications /></ProtectedVisibleRoute>} />
                    <Route path="/explore-data-careers" element={<ProtectedVisibleRoute><ExploreDataCareers /></ProtectedVisibleRoute>} />
                    <Route path="/profile" element={<ProtectedVisibleRoute><Profile /></ProtectedVisibleRoute>} />
                    <Route path="/calendar" element={<ProtectedVisibleRoute><Calendar /></ProtectedVisibleRoute>} />
                    <Route path="/assistants" element={<ProtectedVisibleRoute><Assistants /></ProtectedVisibleRoute>} />
                    <Route path="/assistant/:assistantId?" element={<ProtectedVisibleRoute><AssistantInterface /></ProtectedVisibleRoute>} />
                    <Route path="/messages" element={<ProtectedVisibleRoute><Messages /></ProtectedVisibleRoute>} />
                    <Route path="/messages/:conversationId?" element={<ProtectedVisibleRoute><Messages /></ProtectedVisibleRoute>} />
                    <Route path="/resume" element={<ProtectedVisibleRoute><Resume /></ProtectedVisibleRoute>} />

                    <Route path="/resources/data-blueprint" element={<Navigate to="/data-blueprint" replace />} />
                    <Route path="/resources/data-blueprint/:slug" element={<Navigate to="/blog/:slug" replace />} />

                    {/* Admin protected routes */}
                    <Route path="/admin" element={<ProtectedVisibleRoute requireAdmin>{<AdminDashboard />}</ProtectedVisibleRoute>} />
                    <Route path="/admin/activity" element={<ProtectedVisibleRoute requireAdmin>{<AdminActivity />}</ProtectedVisibleRoute>} />
                    <Route path="/admin/courses" element={<ProtectedVisibleRoute requireAdmin><CourseManagementDashboard /></ProtectedVisibleRoute>} />
                    <Route path="/admin/courses/:courseId/edit" element={<ProtectedVisibleRoute requireAdmin><AdminCourseEdit /></ProtectedVisibleRoute>} />
                    <Route path="/admin/courses/new" element={<ProtectedVisibleRoute requireAdmin><AdminCourseEdit /></ProtectedVisibleRoute>} />
                    <Route path="/courses/:courseId/materials" element={<ProtectedVisibleRoute><CourseManageMaterials /></ProtectedVisibleRoute>} />
                    <Route path="/admin/users" element={<ProtectedVisibleRoute requireAdmin><AdminUsers /></ProtectedVisibleRoute>} />
                    <Route path="/admin/enrollments" element={<ProtectedVisibleRoute requireAdmin><AdminEnrollments /></ProtectedVisibleRoute>} />
                    <Route path="/admin/certificates" element={<ProtectedVisibleRoute requireAdmin><AdminCertificates /></ProtectedVisibleRoute>} />
                    <Route path="/admin/resources" element={<ProtectedVisibleRoute requireAdmin><AdminResources /></ProtectedVisibleRoute>} />
                    <Route path="/admin/events" element={<ProtectedVisibleRoute requireAdmin><AdminEvents /></ProtectedVisibleRoute>} />
                    <Route path="/admin/settings" element={<ProtectedVisibleRoute requireAdmin><AdminDashboard /></ProtectedVisibleRoute>} />
                    <Route path="/admin/blog" element={<ProtectedVisibleRoute requireAdmin><AdminBlogPosts /></ProtectedVisibleRoute>} />
                    <Route path="/admin/blog/create" element={<ProtectedVisibleRoute requireAdmin><CreateBlogPost /></ProtectedVisibleRoute>} />
                    <Route path="/admin/page-visibility" element={<ProtectedVisibleRoute requireAdmin><AdminPageVisibility /></ProtectedVisibleRoute>} />
                    <Route path="/components/LocalStorageDebug.tsx" element={<ProtectedVisibleRoute requireAdmin><LocalStorageDebug /></ProtectedVisibleRoute>} />

                    {/* Catch all NotFound */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </PageVisibilityProvider>
              </AuthProvider>
            </TooltipProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

export default App;
