
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { BlogManagement } from '@/components/admin/blog/BlogManagement';
import BlogPostEditor from '@/components/admin/blog/BlogPostEditor';
import AdminGuard from '@/components/admin/AdminGuard';

export default function BlogAdmin() {
  return (
    <AdminGuard>
      <AppLayout>
        <Routes>
          <Route index element={<BlogManagement />} />
          <Route path="new" element={<BlogPostEditor />} />
          <Route path="edit/:slug" element={<BlogPostEditor />} />
        </Routes>
      </AppLayout>
    </AdminGuard>
  );
}
