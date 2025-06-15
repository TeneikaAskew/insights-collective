
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminGuard from '@/components/admin/AdminGuard';

export default function PageVisibility() {
  return (
    <AdminGuard>
      <AppLayout>
        <div className="container mx-auto py-6">
          <Card>
            <CardHeader>
              <CardTitle>Page Visibility Settings</CardTitle>
              <CardDescription>
                Manage which pages are visible to different user roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Page visibility management interface will be implemented here.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </AdminGuard>
  );
}
