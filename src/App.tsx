import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import { PageVisibilityProvider } from "./contexts/PageVisibilityContext";
import { ToastProvider } from "@/hooks/use-toast";
import { Navbar } from '@/components/layout/Navbar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { CodePractice } from '@/pages/CodePractice';
import { StudyGuideGenerator } from '@/components/study-guide/StudyGuideGenerator';
import { MockInterviewRoom } from '@/components/mock-interview/MockInterviewRoom';
import { RecommendationEngine } from '@/components/recommendations/RecommendationEngine';
import { ThemeProvider } from '@/components/theme-provider';

// Import page components
import Index from "./pages/Index";
import DashboardPage from "./pages/Dashboard";
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
import PortfolioExplorer from "./pages/PortfolioExplorer";

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

// Import the new LocalStorageDebug page (fixed import path)
import LocalStorageDebugPage from "./pages/admin/LocalStorageDebug";

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
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="container mx-auto py-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/code-practice" element={<CodePractice />} />
              <Route path="/study-guides" element={<StudyGuideGenerator />} />
              <Route 
                path="/mock-interviews/:sessionId" 
                element={<MockInterviewRoom sessionId="test" participantRole="interviewee" />} 
              />
              <Route path="/recommendations" element={<RecommendationEngine />} />
            </Routes>
          </main>
          <Toaster />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
