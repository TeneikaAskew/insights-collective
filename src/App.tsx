
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from "@/contexts/AuthContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminGuard from "@/components/admin/AdminGuard";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import ModuleDetail from "./pages/ModuleDetail";
import LessonDetail from "./pages/LessonDetail";
import AssignmentDetail from "./pages/AssignmentDetail";
import Messages from "./pages/Messages";
import Events from "./pages/Events";
import Portfolio from "./pages/Portfolio";
import PortfolioEditor from "./pages/PortfolioEditor";
import PortfolioView from "./pages/PortfolioView";
import Resume from "./pages/Resume";
import Assistants from "./pages/Assistants";
import AssistantChat from "./pages/AssistantChat";
import Forums from "./pages/Forums";
import ForumDetail from "./pages/ForumDetail";
import ThreadDetail from "./pages/ThreadDetail";
import NotFound from "./pages/NotFound";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <OnboardingProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/courses" element={<Courses />} />
                  <Route path="/courses/:courseId" element={<CourseDetail />} />
                  <Route path="/courses/:courseId/modules/:moduleId" element={<ModuleDetail />} />
                  <Route path="/courses/:courseId/modules/:moduleId/lessons/:lessonId" element={<LessonDetail />} />
                  <Route path="/courses/:courseId/modules/:moduleId/assignments/:assignmentId" element={<AssignmentDetail />} />
                  <Route path="/courses/:courseId/forums" element={<Forums />} />
                  <Route path="/courses/:courseId/forums/:forumId" element={<ForumDetail />} />
                  <Route path="/courses/:courseId/forums/:forumId/threads/:threadId" element={<ThreadDetail />} />
                  
                  <Route path="/messages" element={
                    <ProtectedRoute>
                      <Messages />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/events" element={<Events />} />
                  
                  <Route path="/portfolio" element={
                    <ProtectedRoute>
                      <Portfolio />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/portfolio/editor" element={
                    <ProtectedRoute>
                      <PortfolioEditor />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/portfolio/:userId" element={<PortfolioView />} />
                  
                  <Route path="/resume" element={
                    <ProtectedRoute>
                      <Resume />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/assistants" element={
                    <ProtectedRoute>
                      <Assistants />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/assistants/:conversationId" element={
                    <ProtectedRoute>
                      <AssistantChat />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </OnboardingProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
