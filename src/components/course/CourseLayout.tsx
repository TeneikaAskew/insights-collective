// ABOUTME: Layout component for course-specific pages providing LMS-style interface
// ABOUTME: Wraps course pages with course sidebar navigation and consistent header including main navbar

import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CourseSidebar } from './CourseSidebar';
import { Toaster } from '@/components/ui/toaster';
import Navbar from '@/components/layout/Navbar';

interface CourseLayoutProps {
  children: ReactNode;
}

function readSidebarCookie(cookieName: string, fallback: boolean): boolean {
  if (typeof document === 'undefined') return fallback;

  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${cookieName}=`));

  if (!match) return fallback;

  return match.split('=')[1] === 'true';
}

function writeSidebarCookie(cookieName: string, value: boolean) {
  if (typeof document === 'undefined') return;

  document.cookie = `${cookieName}=${value}; path=/; max-age=${60 * 60 * 24 * 7}`;
}

export function CourseLayout({ children }: CourseLayoutProps) {
  const location = useLocation();
  const { courseId } = useParams();

  const isCourseHome = location.pathname === `/courses/${courseId}`;
  const routeContext = isCourseHome ? 'course-home' : `course-subpage:${location.pathname}`;
  const cookieName = useMemo(
    () => `course-sidebar:state:${courseId ?? 'unknown-course'}`,
    [courseId]
  );
  const previousRouteContextRef = useRef(routeContext);

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    isCourseHome ? readSidebarCookie(cookieName, true) : false
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (previousRouteContextRef.current === routeContext) {
      return;
    }

    setSidebarOpen(isCourseHome ? readSidebarCookie(cookieName, true) : false);
    setMobileSidebarOpen(false);
    previousRouteContextRef.current = routeContext;
  }, [cookieName, isCourseHome, routeContext]);

  const handleSidebarOpenChange = useCallback((open: boolean) => {
    setSidebarOpen(open);

    if (isCourseHome) {
      writeSidebarCookie(cookieName, open);
    }
  }, [cookieName, isCourseHome]);

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={handleSidebarOpenChange}
      mobileOpen={mobileSidebarOpen}
      onMobileOpenChange={setMobileSidebarOpen}
    >
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
