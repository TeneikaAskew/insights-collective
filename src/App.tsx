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
import PageVisibilityGuard from "./components/PageVisibilityGuard";
import AdminGuard from "./components/admin/AdminGuard";

// Import course management components
import CourseManagementDashboard from '@/components/course/management/CourseManagementDashboard';
import CourseEditor from '@/components/course/management/CourseEditor';
import CourseManageMaterials from './pages/CourseManageMaterials';

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
        <ToastProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              {/* Note the important re-ordering here: AuthProvider must wrap PageVisibilityProvider */}
              <AuthProvider>
                <PageVisibilityProvider>
                  <Routes>
                    <Route path="/" element={<PageVisibilityGuard><Index /></PageVisibilityGuard>} />
                    <Route path="/dashboard" element={<PageVisibilityGuard><Dashboard /></PageVisibilityGuard>} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/courses" element={<PageVisibilityGuard><CourseList /></PageVisibilityGuard>} />
                    <Route path="/courses/:courseId" element={<PageVisibilityGuard><CourseDetail /></PageVisibilityGuard>} />
                    <Route path="/courses/:courseId/modules/:moduleId" element={<PageVisibilityGuard><ModuleDetail /></PageVisibilityGuard>} />
                    <Route path="/resources" element={<PageVisibilityGuard><Resources /></PageVisibilityGuard>} />
                    
                    <Route path="/data-blueprint" element={<PageVisibilityGuard><DataBlueprintSeries /></PageVisibilityGuard>} />
                    
                    <Route path="/blog" element={<PageVisibilityGuard><BlogList /></PageVisibilityGuard>} />
                    <Route path="/blog/:slug" element={<PageVisibilityGuard><BlogPost /></PageVisibilityGuard>} />
                    
                    <Route path="/events" element={<PageVisibilityGuard><Events /></PageVisibilityGuard>} />
                    <Route path="/notifications" element={<PageVisibilityGuard><Notifications /></PageVisibilityGuard>} />
                    <Route path="/explore-data-careers" element={<PageVisibilityGuard><ExploreDataCareers /></PageVisibilityGuard>} />
                    <Route path="/profile" element={<PageVisibilityGuard><Profile /></PageVisibilityGuard>} />
                    <Route path="/calendar" element={<PageVisibilityGuard><Calendar /></PageVisibilityGuard>} />
                    <Route path="/assistants" element={<PageVisibilityGuard><Assistants /></PageVisibilityGuard>} />
                    <Route path="/assistant/:assistantId?" element={<PageVisibilityGuard><AssistantInterface /></PageVisibilityGuard>} />
                    <Route path="/messages" element={<PageVisibilityGuard><Messages /></PageVisibilityGuard>} />
                    <Route path="/messages/:conversationId?" element={<PageVisibilityGuard><Messages /></PageVisibilityGuard>} />
                    <Route path="/resume" element={<PageVisibilityGuard><Resume /></PageVisibilityGuard>} />
                    
                    <Route path="/resources/data-blueprint" element={<Navigate to="/data-blueprint" replace />} />
                    <Route path="/resources/data-blueprint/:slug" element={<Navigate to="/blog/:slug" replace />} />
                    
                    <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
                    <Route path="/admin/activity" element={<AdminGuard><AdminActivity /></AdminGuard>} />
                    <Route path="/admin/courses" element={
                      <AdminGuard>
                        <CourseManagementDashboard />
                      </AdminGuard>
                    } />
                    <Route path="/admin/courses/:courseId/edit" element={
                      <AdminGuard>
                        <CourseEditor />
                      </AdminGuard>
                    } />
                    <Route path="/admin/courses/new" element={
                      <AdminGuard>
                        <CourseEditor />
                      </AdminGuard>
                    } />
                    <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
                    <Route path="/admin/enrollments" element={<AdminGuard><AdminEnrollments /></AdminGuard>} />
                    <Route path="/admin/certificates" element={<AdminGuard><AdminCertificates /></AdminGuard>} />
                    <Route path="/admin/resources" element={<AdminGuard><AdminResources /></AdminGuard>} />
                    <Route path="/admin/events" element={<AdminGuard><AdminEvents /></AdminGuard>} />
                    <Route path="/admin/settings" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
                    <Route path="/admin/blog" element={<AdminGuard><AdminBlogPosts /></AdminGuard>} />
                    <Route path="/admin/blog/create" element={<AdminGuard><CreateBlogPost /></AdminGuard>} />
                    <Route path="/admin/page-visibility" element={<AdminGuard><AdminPageVisibility /></AdminGuard>} />
                    
                    <Route path="/courses/:courseId/materials" element={
                      <PageVisibilityGuard>
                        <CourseManageMaterials />
                      </PageVisibilityGuard>
                    } />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  {/* Temporarily removed ChatBot to fix console errors */}
                </PageVisibilityProvider>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </ToastProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

export default App;
