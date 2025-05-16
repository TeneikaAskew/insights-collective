import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { PageVisibilityProvider } from '@/contexts/PageVisibilityContext';
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import UserDashboard from '@/pages/UserDashboard';
import Courses from '@/pages/Courses';
import CourseDetails from '@/pages/CourseDetails';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminCourses from '@/pages/AdminCourses';
import AdminUsers from '@/pages/AdminUsers';
import AdminCourseEdit from '@/pages/AdminCourseEdit';
import AdminCourseCreate from '@/pages/AdminCourseCreate';
import Resources from '@/pages/Resources';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import Chat from '@/pages/Chat';
import CourseWishlist from '@/pages/CourseWishlist';
import Resumes from '@/pages/Resumes';
import CareerPathway from '@/pages/CareerPathway';
import Notifications from '@/pages/Notifications';
import { ToastProvider } from '@/hooks/use-toast';
import PortfolioExplorer from '@/pages/PortfolioExplorer';

function App() {
  return (
    <div className="App">
      <ToastProvider>
        <BrowserRouter>
          <PageVisibilityProvider>
            <AuthProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/dashboard" element={<UserDashboard />} />
                  <Route path="/portfolio-explorer" element={<PortfolioExplorer />} />
                  <Route path="/courses" element={<Courses />} />
                  <Route path="/courses/:courseId" element={<CourseDetails />} />
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/wishlist" element={<CourseWishlist />} />
                  <Route path="/resumes" element={<Resumes />} />
                  <Route path="/career-pathway" element={<CareerPathway />} />
                  <Route path="/notifications" element={<Notifications />} />

                  {/* Admin Routes */}
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/courses" element={<AdminCourses />} />
                  <Route path="/admin/courses/create" element={<AdminCourseCreate />} />
                  <Route path="/admin/courses/:courseId/edit" element={<AdminCourseEdit />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                </Routes>
            </AuthProvider>
          </PageVisibilityProvider>
        </BrowserRouter>
      </ToastProvider>
    </div>
  );
}

export default App;
