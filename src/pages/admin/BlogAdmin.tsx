import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { BlogManagement } from '@/components/admin/blog/BlogManagement';
import NewBlogPost from '@/pages/admin/blog/NewBlogPost';
import EditBlogPost from '@/pages/admin/blog/EditBlogPost';

// Access control and the page shell live at the route: App.tsx wraps this in
// ProtectedRoute (requireAdmin allowInstructor) + AdminLayout.
export default function BlogAdmin() {
  return (
    <Routes>
      <Route index element={<BlogManagement />} />
      <Route path="new" element={<NewBlogPost />} />
      <Route path="edit/:id" element={<EditBlogPost />} />
    </Routes>
  );
}
