
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PageVisibilityProvider } from "./contexts/PageVisibilityContext";
import { ToastProvider } from "@/hooks/use-toast";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CourseList from "./pages/CourseList";
import CourseDetail from "./pages/CourseDetail";
import ModuleDetail from "./pages/ModuleDetail";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import Resources from "./pages/Resources";
import Events from "./pages/Events";
import Notifications from "./pages/Notifications";
import AdminResources from "./pages/AdminResources";
import AdminEvents from "./pages/AdminEvents";
import AdminUsers from "./pages/AdminUsers";
import AdminEnrollments from "./pages/AdminEnrollments";
import AdminCertificates from "./pages/AdminCertificates";
import AdminActivity from "./pages/AdminActivity";
import AdminCourses from "./pages/AdminCourses";
import Assistants from "./pages/Assistants";
import AssistantInterface from "./pages/AssistantInterface";
import NotFound from "./pages/NotFound";
import Calendar from "./pages/Calendar";
import DataBlueprintSeries from "./pages/DataBlueprintSeries";
import ExploreDataCareers from "./pages/ExploreDataCareers";
// import ChatBot from "./components/chat/ChatBot";  // Temporarily comment out to fix console errors
import Messages from "./pages/Messages";
import Resume from "./pages/Resume";
import AdminGuard from "./components/admin/AdminGuard";
import BlogList from "./pages/BlogList";
import BlogPost from "./pages/BlogPost";
import AdminBlogPosts from "./pages/AdminBlogPosts";
import CreateBlogPost from "./pages/CreateBlogPost";
import AdminPageVisibility from "./pages/AdminPageVisibility";
import PageVisibilityGuard from "./components/PageVisibilityGuard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
                
                {/* Moved Data Blueprint to top level route */}
                <Route path="/data-blueprint" element={<PageVisibilityGuard><DataBlueprintSeries /></PageVisibilityGuard>} />
                
                {/* Blog Routes */}
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
                
                {/* Redirect old routes to new locations */}
                <Route path="/resources/data-blueprint" element={<Navigate to="/data-blueprint" replace />} />
                <Route path="/resources/data-blueprint/:slug" element={<Navigate to="/blog/:slug" replace />} />
                
                {/* Protected Admin Routes */}
                <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
                <Route path="/admin/activity" element={<AdminGuard><AdminActivity /></AdminGuard>} />
                <Route path="/admin/courses" element={<AdminGuard><AdminCourses /></AdminGuard>} />
                <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
                <Route path="/admin/enrollments" element={<AdminGuard><AdminEnrollments /></AdminGuard>} />
                <Route path="/admin/certificates" element={<AdminGuard><AdminCertificates /></AdminGuard>} />
                <Route path="/admin/resources" element={<AdminGuard><AdminResources /></AdminGuard>} />
                <Route path="/admin/events" element={<AdminGuard><AdminEvents /></AdminGuard>} />
                <Route path="/admin/settings" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
                <Route path="/admin/blog" element={<AdminGuard><AdminBlogPosts /></AdminGuard>} />
                <Route path="/admin/blog/create" element={<AdminGuard><CreateBlogPost /></AdminGuard>} />
                <Route path="/admin/page-visibility" element={<AdminGuard><AdminPageVisibility /></AdminGuard>} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
              {/* Temporarily removed ChatBot to fix console errors */}
            </PageVisibilityProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ToastProvider>
  </QueryClientProvider>
);

export default App;
