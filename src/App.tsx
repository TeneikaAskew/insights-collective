
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from '@/contexts/AuthContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { Toaster } from '@/components/ui/toaster';
import { Spinner } from '@/components/ui/spinner';

// More robust lazy loading with error handling
const Index = React.lazy(() => 
  import('@/pages/Index').catch(error => {
    console.error('Failed to load Index component:', error);
    // Return a fallback component or retry
    return { default: () => <div>Error loading page. Please refresh.</div> };
  })
);

const Resources = React.lazy(() => import('@/pages/Resources'));
const CareerAgent = React.lazy(() => import('@/pages/CareerAgent'));
const CareerPathway = React.lazy(() => import('@/pages/CareerPathway'));
const PortfolioExplorer = React.lazy(() => import('@/pages/PortfolioExplorer'));
const Login = React.lazy(() => import('@/pages/Login'));
const Register = React.lazy(() => import('@/pages/Register'));
const Profile = React.lazy(() => import('@/pages/Profile'));
const UserDashboard = React.lazy(() => import('@/pages/UserDashboard'));
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const AdminDashboard = React.lazy(() => import('@/pages/AdminDashboard'));
const InterviewPrep = React.lazy(() => import('@/pages/InterviewPrep'));
const CodePractice = React.lazy(() => import('@/pages/interview-prep/CodePractice'));
const StarPractice = React.lazy(() => import('@/pages/interview-prep/StarPractice'));
const JobDescription = React.lazy(() => import('@/pages/interview-prep/JobDescription'));
const MockInterviews = React.lazy(() => import('@/pages/interview-prep/MockInterviews'));
const ExploreDataCareers = React.lazy(() => import('@/pages/ExploreDataCareers'));
const Resume = React.lazy(() => import('@/pages/Resume'));
const Survey = React.lazy(() => import('@/pages/Survey'));
const SurveyConfirmation = React.lazy(() => import('@/pages/SurveyConfirmation'));
const Notifications = React.lazy(() => import('@/pages/Notifications'));
const ThreadDetail = React.lazy(() => import('@/pages/ThreadDetail'));
const ForumDetail = React.lazy(() => import('@/pages/ForumDetail'));
const ForumList = React.lazy(() => import('@/pages/ForumList'));
const CourseList = React.lazy(() => import('@/pages/CourseList'));
const CourseDetail = React.lazy(() => import('@/pages/CourseDetail'));
const Events = React.lazy(() => import('@/pages/Events'));
const Messages = React.lazy(() => import('@/pages/Messages'));
const Assistants = React.lazy(() => import('@/pages/Assistants'));
const DataBlueprint = React.lazy(() => import('@/pages/DataBlueprint'));
const NotFound = React.lazy(() => import('@/pages/NotFound'));

// Enhanced Query Client configuration with better caching and performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (renamed from cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors except 408 (timeout)
        if (error?.status >= 400 && error?.status < 500 && error?.status !== 408) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Loading component for suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Spinner className="h-8 w-8" />
  </div>
);

// Error boundary component for better error handling
class LazyLoadErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy load error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OnboardingProvider>
            <Router>
              <div className="min-h-screen bg-background">
                <LazyLoadErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/user-dashboard" element={<UserDashboard />} />
                      <Route path="/admin-dashboard" element={<AdminDashboard />} />
                      <Route path="/resources" element={<Resources />} />
                      <Route path="/career-agent" element={<CareerAgent />} />
                      <Route path="/career-pathway" element={<CareerPathway />} />
                      <Route path="/portfolio-explorer" element={<PortfolioExplorer />} />
                      <Route path="/courses" element={<CourseList />} />
                      <Route path="/courses/:id" element={<CourseDetail />} />
                      <Route path="/events" element={<Events />} />
                      <Route path="/forums" element={<ForumList />} />
                      <Route path="/messages" element={<Messages />} />
                      <Route path="/assistants" element={<Assistants />} />
                      <Route path="/data-blueprint" element={<DataBlueprint />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/interview-prep" element={<InterviewPrep />} />
                      <Route path="/interview-prep/code-practice" element={<CodePractice />} />
                      <Route path="/interview-prep/star-practice" element={<StarPractice />} />
                      <Route path="/interview-prep/job-description" element={<JobDescription />} />
                      <Route path="/interview-prep/mock-interviews" element={<MockInterviews />} />
                      <Route path="/explore-data-careers" element={<ExploreDataCareers />} />
                      <Route path="/resume" element={<Resume />} />
                      <Route path="/survey" element={<Survey />} />
                      <Route path="/survey/:slug" element={<Survey />} />
                      <Route path="/survey/:slug/confirmation" element={<SurveyConfirmation />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/courses/:courseId/forums/:forumId/threads/:threadId" element={<ThreadDetail />} />
                      <Route path="/courses/:courseId/forums/:forumId" element={<ForumDetail />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </LazyLoadErrorBoundary>
                <Toaster />
              </div>
            </Router>
          </OnboardingProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
