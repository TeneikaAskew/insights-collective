
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { BlogManagement } from '@/components/admin/blog/BlogManagement';
import BlogPostForm from '@/components/blog/BlogPostForm';
import AdminGuard from '@/components/admin/AdminGuard';

export default function BlogAdmin() {
  return (
    <AdminGuard>
      <AppLayout>
        <div className="container mx-auto py-8 px-4">
          <Routes>
            <Route index element={<BlogManagement />} />
            <Route path="new" element={<BlogPostForm />} />
            <Route path="edit/:slug" element={<BlogPostForm />} />
          </Routes>
        </div>
      </AppLayout>
    </AdminGuard>
  );
}
