
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
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
import AdminResources from "./pages/AdminResources";
import AdminEvents from "./pages/AdminEvents";
import AdminUsers from "./pages/AdminUsers";
import AdminEnrollments from "./pages/AdminEnrollments";
import AdminCertificates from "./pages/AdminCertificates";
import AdminActivity from "./pages/AdminActivity";
import AdminCourses from "./pages/AdminCourses";
import Assistants from "./pages/Assistants";
import NotFound from "./pages/NotFound";
import Calendar from "./pages/Calendar";
import DataBlueprintSeries from "./pages/DataBlueprintSeries";
import ExploreDataCareers from "./pages/ExploreDataCareers";
import ChatBot from "./components/chat/ChatBot";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/courses" element={<CourseList />} />
              <Route path="/courses/:courseId" element={<CourseDetail />} />
              <Route path="/courses/:courseId/modules/:moduleId" element={<ModuleDetail />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/resources/data-blueprint" element={<DataBlueprintSeries />} />
              <Route path="/events" element={<Events />} />
              <Route path="/explore-data-careers" element={<ExploreDataCareers />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/assistants" element={<Assistants />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/activity" element={<AdminActivity />} />
              <Route path="/admin/courses" element={<AdminCourses />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/enrollments" element={<AdminEnrollments />} />
              <Route path="/admin/certificates" element={<AdminCertificates />} />
              <Route path="/admin/resources" element={<AdminResources />} />
              <Route path="/admin/events" element={<AdminEvents />} />
              <Route path="/admin/settings" element={<AdminDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ChatBot />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ToastProvider>
  </QueryClientProvider>
);

export default App;
