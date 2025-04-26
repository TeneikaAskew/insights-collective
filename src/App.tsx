
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
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/career-agent" element={<CareerAgent />} />
                    <Route path="/career-pathway" element={<CareerPathway />} />

                    {/* Protected public routes with visibility checks */}
                    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/courses" element={<ProtectedRoute><CourseList /></ProtectedRoute>} />
                    <Route path="/courses/:courseId" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
                    <Route path="/courses/:courseId/modules/:moduleId" element={<ProtectedRoute><ModuleDetail /></ProtectedRoute>} />
                    <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
                    <Route path="/data-blueprint" element={<ProtectedRoute><DataBlueprintSeries /></ProtectedRoute>} />
                    <Route path="/blog" element={<ProtectedRoute><BlogList /></ProtectedRoute>} />
                    <Route path="/blog/:slug" element={<ProtectedRoute><BlogPost /></ProtectedRoute>} />
                    <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
                    <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                    <Route path="/explore-data-careers" element={<ProtectedRoute><ExploreDataCareers /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                    <Route path="/assistants" element={<ProtectedRoute><Assistants /></ProtectedRoute>} />
                    <Route path="/assistant/:assistantId?" element={<ProtectedRoute><AssistantInterface /></ProtectedRoute>} />
                    <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                    <Route path="/messages/:conversationId?" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                    <Route path="/resume" element={<ProtectedRoute><Resume /></ProtectedRoute>} />

                    <Route path="/resources/data-blueprint" element={<Navigate to="/data-blueprint" replace />} />
                    <Route path="/resources/data-blueprint/:slug" element={<Navigate to="/blog/:slug" replace />} />

                    {/* Admin protected routes */}
                    <Route path="/admin" element={<ProtectedRoute requireAdmin>{<AdminDashboard />}</ProtectedRoute>} />
                    <Route path="/admin/activity" element={<ProtectedRoute requireAdmin>{<AdminActivity />}</ProtectedRoute>} />
                    <Route path="/admin/courses" element={<ProtectedRoute requireAdmin><CourseManagementDashboard /></ProtectedRoute>} />
                    <Route path="/admin/courses/:courseId/edit" element={<ProtectedRoute requireAdmin><AdminCourseEdit /></ProtectedRoute>} />
                    <Route path="/admin/courses/new" element={<ProtectedRoute requireAdmin><AdminCourseEdit /></ProtectedRoute>} />
                    <Route path="/courses/:courseId/materials" element={<ProtectedRoute><CourseManageMaterials /></ProtectedRoute>} />
                    <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
                    <Route path="/admin/enrollments" element={<ProtectedRoute requireAdmin><AdminEnrollments /></ProtectedRoute>} />
                    <Route path="/admin/certificates" element={<ProtectedRoute requireAdmin><AdminCertificates /></ProtectedRoute>} />
                    <Route path="/admin/resources" element={<ProtectedRoute requireAdmin><AdminResources /></ProtectedRoute>} />
                    <Route path="/admin/events" element={<ProtectedRoute requireAdmin><AdminEvents /></ProtectedRoute>} />
                    <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin/blog" element={<ProtectedRoute requireAdmin><AdminBlogPosts /></ProtectedRoute>} />
                    <Route path="/admin/blog/create" element={<ProtectedRoute requireAdmin><CreateBlogPost /></ProtectedRoute>} />
                    <Route path="/admin/page-visibility" element={<ProtectedRoute requireAdmin><AdminPageVisibility /></ProtectedRoute>} />
                    <Route path="/components/LocalStorageDebug.tsx" element={<ProtectedRoute requireAdmin><LocalStorageDebug /></ProtectedRoute>} />

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
