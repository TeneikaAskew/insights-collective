
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CourseList from './pages/CourseList';
import CoursePage from './pages/CoursePage';
import MessagesPage from './pages/MessagesPage';
import ConversationPage from './pages/ConversationPage';
import ProfilePage from './pages/ProfilePage';
import CareerQuizPage from './pages/CareerQuizPage';
import QuizResultsPage from './pages/QuizResultsPage';
import AdminCourses from './pages/AdminCourses';
import EventsPage from './pages/EventsPage';
import EventDetailsPage from './pages/EventDetailsPage';
import ResumeAnalysisPage from './pages/ResumeAnalysisPage';
import ResourcesPage from './pages/ResourcesPage';
import NotFoundPage from './pages/NotFoundPage';
import LearningPathsPage from './pages/LearningPathsPage';
import LearningPathDetailPage from './pages/LearningPathDetailPage';
import CourseManagementDashboard from './components/course/management/CourseManagementDashboard';
import CourseEditor from './components/course/management/CourseEditor';
import CourseManagementPage from './pages/CourseManagementPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/courses" element={<CourseList />} />
      <Route path="/courses/:courseId" element={<CoursePage />} />
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="/messages/:conversationId" element={<ConversationPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/career-quiz" element={<CareerQuizPage />} />
      <Route path="/quiz-results/:quizId" element={<QuizResultsPage />} />
      <Route path="/admin/courses" element={<AdminCourses />} />
      <Route path="/admin/courses/:courseId/edit" element={<CourseEditor />} />
      <Route path="/admin/manage-course/:courseId/:section" element={<CourseManagementPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/:eventId" element={<EventDetailsPage />} />
      <Route path="/resume-analysis" element={<ResumeAnalysisPage />} />
      <Route path="/resources" element={<ResourcesPage />} />
      <Route path="/learning-paths" element={<LearningPathsPage />} />
      <Route path="/learning-paths/:pathId" element={<LearningPathDetailPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
