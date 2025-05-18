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
import { ThemeProvider } from '@/components/theme-provider';
import Sidebar from '@/components/layout/Sidebar';

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

// Import interview prep components
import { CodePractice } from '@/pages/CodePractice';
import { StudyGuideGenerator } from '@/components/study-guide/StudyGuideGenerator';
import { MockInterviewRoom } from '@/components/mock-interview/MockInterviewRoom';
import { RecommendationEngine } from '@/components/recommendations/RecommendationEngine';

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
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PageVisibilityProvider>
            <ToastProvider>
              <TooltipProvider>
                <BrowserRouter>
                  <div className="min-h-screen bg-background flex">
                    <Sidebar expanded={true} setExpanded={() => {}} />
                    <div className="flex-1">
                      <Navbar />
                      <main className="container mx-auto py-6">
                        <Routes>
                          {/* Interview Prep Routes */}
                          <Route path="/interview-prep" element={<Dashboard />} />
                          <Route path="/interview-prep/code-practice" element={<CodePractice />} />
                          <Route path="/interview-prep/study-guides" element={<StudyGuideGenerator />} />
                          <Route 
                            path="/interview-prep/mock-interviews/:sessionId" 
                            element={<MockInterviewRoom sessionId="default" participantRole="interviewee" />} 
                          />
                          <Route path="/interview-prep/recommendations" element={<RecommendationEngine />} />
                          
                          {/* Other existing routes can go here */}
                          <Route path="/" element={<Index />} />
                          <Route path="/dashboard" element={<DashboardPage />} />
                          <Route path="/login" element={<Login />} />
                          <Route path="/register" element={<Register />} />
                          <Route path="/course-list" element={<CourseList />} />
                          <Route path="/course-detail/:id" element={<CourseDetail />} />
                          <Route path="/module-detail/:id" element={<ModuleDetail />} />
                          <Route path="/resources" element={<Resources />} />
                          <Route path="/data-blueprint-series" element={<DataBlueprintSeries />} />
                          <Route path="/blog-list" element={<BlogList />} />
                          <Route path="/blog-post/:id" element={<BlogPost />} />
                          <Route path="/events" element={<Events />} />
                          <Route path="/notifications" element={<Notifications />} />
                          <Route path="/explore-data-careers" element={<ExploreDataCareers />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/calendar" element={<Calendar />} />
                          <Route path="/assistants" element={<Assistants />} />
                          <Route path="/assistant-interface" element={<AssistantInterface />} />
                          <Route path="/messages" element={<Messages />} />
                          <Route path="/resume" element={<Resume />} />
                          <Route path="/not-found" element={<NotFound />} />
                          <Route path="/career-pathway" element={<CareerPathway />} />
                          <Route path="/survey-confirmation" element={<SurveyConfirmation />} />
                          <Route path="/auth-callback" element={<AuthCallback />} />
                          <Route path="/portfolio-explorer" element={<PortfolioExplorer />} />
                          <Route path="/admin-dashboard" element={<AdminDashboard />} />
                          <Route path="/admin-activity" element={<AdminActivity />} />
                          <Route path="/admin-users" element={<AdminUsers />} />
                          <Route path="/admin-enrollments" element={<AdminEnrollments />} />
                          <Route path="/admin-certificates" element={<AdminCertificates />} />
                          <Route path="/admin-resources" element={<AdminResources />} />
                          <Route path="/admin-events" element={<AdminEvents />} />
                          <Route path="/admin-blog-posts" element={<AdminBlogPosts />} />
                          <Route path="/create-blog-post" element={<CreateBlogPost />} />
                          <Route path="/edit-blog-post/:id" element={<EditBlogPost />} />
                          <Route path="/admin-page-visibility" element={<AdminPageVisibility />} />
                          <Route path="/admin-forms" element={<AdminForms />} />
                          <Route path="/course-management" element={<CourseManagement />} />
                          <Route path="/course-management-dashboard" element={<CourseManagementDashboard />} />
                          <Route path="/course-editor" element={<CourseEditor />} />
                          <Route path="/course-manage-materials" element={<CourseManageMaterials />} />
                          <Route path="/forum-list" element={<ForumList />} />
                          <Route path="/forum-detail" element={<ForumDetail />} />
                          <Route path="/thread-detail" element={<ThreadDetail />} />
                          <Route path="/admin-course-edit" element={<AdminCourseEdit />} />
                          <Route path="/career-agent" element={<CareerAgent />} />
                          <Route path="/survey-page" element={<SurveyPage />} />
                          <Route path="/survey-form-edit" element={<SurveyFormEdit />} />
                          <Route path="/survey-form-create" element={<SurveyFormCreate />} />
                          <Route path="/unified-form-management" element={<UnifiedFormManagement />} />
                          <Route path="/form-management" element={<FormManagement />} />
                        </Routes>
                      </main>
                      <Toaster />
                      <Sonner />
                    </div>
                  </div>
                </BrowserRouter>
              </TooltipProvider>
            </ToastProvider>
          </PageVisibilityProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
