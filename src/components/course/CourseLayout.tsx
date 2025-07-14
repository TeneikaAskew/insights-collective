// ABOUTME: Layout component for course-specific pages providing LMS-style interface
// ABOUTME: Wraps course pages with course sidebar navigation and consistent header including main navbar

import React, { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CourseSidebar } from './CourseSidebar';
import { Toaster } from '@/components/ui/toaster';
import Navbar from '@/components/layout/Navbar';

interface CourseLayoutProps {
  children: ReactNode;
}

export function CourseLayout({ children }: CourseLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex flex-col w-full bg-background">
        <Navbar />
        
        <div className="flex flex-1 w-full">
          <CourseSidebar />
          
          <main className="flex-1 overflow-auto">
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
        
        <Toaster />
      </div>
    </SidebarProvider>
  );
}