
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';

// Admin Pages
import AdminCourses from '@/pages/AdminCourses';
import AdminUsers from '@/pages/AdminUsers';

// Course Pages
import CourseEdit from '@/pages/CourseEdit';
import CourseManageMaterials from '@/pages/CourseManageMaterials';
import CourseInstructors from '@/pages/CourseInstructors';

// Add other pages as needed...

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Admin routes */}
          <Route path="/admin/courses" element={<AdminCourses />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          
          {/* Course management routes */}
          <Route path="/courses/:courseId/edit" element={<CourseEdit />} />
          <Route path="/courses/:courseId/materials" element={<CourseManageMaterials />} />
          <Route path="/courses/:courseId/instructors" element={<CourseInstructors />} />
          
          {/* Add other routes as needed */}
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/admin/courses" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App;
