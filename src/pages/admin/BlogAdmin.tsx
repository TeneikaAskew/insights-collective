
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { BlogManagementV2 } from '@/components/admin/blog/BlogManagementV2';
import NewBlogPost from '@/pages/admin/blog/NewBlogPost';
import EditBlogPost from '@/pages/admin/blog/EditBlogPost';

// Admin access is enforced by the ProtectedRoute wrapper on /admin/blog/* in
// App.tsx (the single canonical guard), so no per-page guard is needed here.
export default function BlogAdmin() {
  return (
    <AppLayout>
      <Routes>
        <Route index element={<BlogManagementV2 />} />
        <Route path="new" element={<NewBlogPost />} />
        <Route path="edit/:id" element={<EditBlogPost />} />
      </Routes>
    </AppLayout>
  );
}
