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

// SidebarProvider writes to this cookie when toggled but doesn't read it back on mount.
// We read it here so the sidebar state persists across page navigations.
function getSidebarStateFromCookie(): boolean {
  if (typeof document === 'undefined') return true;
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith('sidebar:state='));
  if (match) {
    return match.split('=')[1] === 'true';
  }
  return true;
}

export function CourseLayout({ children }: CourseLayoutProps) {
  return (
    <SidebarProvider defaultOpen={getSidebarStateFromCookie()}>
      <div className="min-h-screen flex flex-col w-full bg-background">
        <div className="sticky top-0 z-50">
          <Navbar />
        </div>
        
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