
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CourseList from './pages/CourseList';
import AdminCourses from './pages/AdminCourses';
import CourseManagementPage from './pages/CourseManagementPage';
import CourseManageMaterials from './pages/CourseManageMaterials';
import CourseEditor from './components/course/management/CourseEditor';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/courses" element={<CourseList />} />
      <Route path="/admin/courses" element={<AdminCourses />} />
      <Route path="/admin/courses/:courseId/edit" element={<CourseEditor />} />
      <Route path="/admin/manage-course/:courseId/:section" element={<CourseManagementPage />} />
      <Route path="/courses/:courseId/materials" element={<CourseManageMaterials />} />
      <Route path="*" element={<Dashboard />} />
    </Routes>
  );
}

export default App;
