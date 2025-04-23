
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PageVisibilityProvider } from "./contexts/PageVisibilityContext";
import { ToastProvider } from "@/hooks/use-toast";
import React from "react";

import ProtectedRoute from "./components/auth/ProtectedRoute";

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
import CareerAgent from "./pages/CareerAgent";

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
import AdminCourseEdit from "./pages/AdminCourseEdit";

import PageVisibilityGuard from "./components/PageVisibilityGuard";

import CourseManagementDashboard from '@/components/course/management/CourseManagementDashboard';
import CourseEditor from '@/components/course/management/CourseEditor';
import CourseManageMaterials from './pages/CourseManageMaterials';

function App() {
  return (
    <React.StrictMode>
      <QueryClientProvider client={new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false }
        }
      })}>
        <ToastProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <PageVisibilityProvider>
                  <Routes>

                    {/* Public routes */}
                    <Route path="/" element={<PageVisibilityGuard><Index /></PageVisibilityGuard>} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/blog" element={<PageVisibilityGuard><BlogList /></PageVisibilityGuard>} />
                    <Route path="/blog/:slug" element={<PageVisibilityGuard><BlogPost /></PageVisibilityGuard>} />
                    <Route path="/career-agent" element={<CareerAgent />} />
                    <Route path="/explore-data-careers" element={<PageVisibilityGuard><ExploreDataCareers /></PageVisibilityGuard>} />

                    {/* Redirects */}
                    <Route path="/resources/data-blueprint" element={<Navigate to="/data-blueprint" replace />} />
                    <Route path="/resources/data-blueprint/:slug" element={<Navigate to="/blog/:slug" replace />} />

                    {/* Protected routes - require auth */}
                    <Route element={<ProtectedRoute />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/courses" element={<CourseList />} />
                      <Route path="/courses/:courseId" element={<CourseDetail />} />
                      <Route path="/courses/:courseId/modules/:moduleId" element={<ModuleDetail />} />
                      <Route path="/resources" element={<Resources />} />
                      <Route path="/career-agent" element={<CareerAgent />} />
                      <Route path="/data-blueprint" element={<DataBlueprintSeries />} />
                      <Route path="/events" element={<Events />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/calendar" element={<Calendar />} />
                      <Route path="/assistants" element={<Assistants />} />
                      <Route path="/assistant/:assistantId?" element={<AssistantInterface />} />
                      <Route path="/messages" element={<Messages />} />
                      <Route path="/messages/:conversationId?" element={<Messages />} />
                      <Route path="/resume" element={<Resume />} />
                      <Route path="/courses/:courseId/materials" element={<CourseManageMaterials />} />
                    </Route>

                    {/* Admin routes - require admin */}
                    <Route element={<ProtectedRoute requireAdmin={true} />}>
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/activity" element={<AdminActivity />} />
                      <Route path="/admin/courses" element={<CourseManagementDashboard />} />
                      <Route path="/admin/courses/:courseId/edit" element={<AdminCourseEdit />} />
                      <Route path="/admin/courses/new" element={<AdminCourseEdit />} />
                      <Route path="/admin/users" element={<AdminUsers />} />
                      <Route path="/admin/enrollments" element={<AdminEnrollments />} />
                      <Route path="/admin/certificates" element={<AdminCertificates />} />
                      <Route path="/admin/resources" element={<AdminResources />} />
                      <Route path="/admin/events" element={<AdminEvents />} />
                      <Route path="/admin/settings" element={<AdminDashboard />} />
                      <Route path="/admin/blog" element={<AdminBlogPosts />} />
                      <Route path="/admin/blog/create" element={<CreateBlogPost />} />
                      <Route path="/admin/page-visibility" element={<AdminPageVisibility />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
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
