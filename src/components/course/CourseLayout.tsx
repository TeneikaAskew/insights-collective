// ABOUTME: Layout component for course-specific pages providing LMS-style interface
// ABOUTME: Wraps course pages with course sidebar navigation and consistent header

import React, { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CourseSidebar } from './CourseSidebar';
import { Toaster } from '@/components/ui/toaster';

interface CourseLayoutProps {
  children: ReactNode;
}

export function CourseLayout({ children }: CourseLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <CourseSidebar />
        
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
        
        <Toaster />
      </div>
    </SidebarProvider>
  );
}