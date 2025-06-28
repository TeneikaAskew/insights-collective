
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { BlogManagementV2 } from '@/components/admin/blog/BlogManagementV2';
import NewBlogPost from '@/pages/admin/blog/NewBlogPost';
import EditBlogPost from '@/pages/admin/blog/EditBlogPost';
import AdminGuard from '@/components/admin/AdminGuard';

export default function BlogAdmin() {
  return (
    <AdminGuard>
      <AppLayout>
        <Routes>
          <Route index element={<BlogManagementV2 />} />
          <Route path="new" element={<NewBlogPost />} />
          <Route path="edit/:id" element={<EditBlogPost />} />
        </Routes>
      </AppLayout>
    </AdminGuard>
  );
}
