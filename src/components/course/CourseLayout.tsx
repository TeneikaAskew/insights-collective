// ABOUTME: Layout component for course-specific pages providing LMS-style interface
// ABOUTME: Wraps course pages with course sidebar navigation and consistent header including main navbar

import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CourseSidebar } from './CourseSidebar';

import Navbar from '@/components/layout/Navbar';
import AppFooter from '@/components/layout/AppFooter';
import { readSidebarCookie, writeSidebarCookie } from '@/lib/sidebarCookie';

interface CourseLayoutProps {
  children: ReactNode;
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

          <div className="flex flex-1 flex-col overflow-auto">
            {/* The gutter matches AppLayout's p-4 rather than keeping its own p-6:
                a reader moving between /courses/:id and /dashboard should not see
                the content start in a different place. */}
            <main className="flex-1">
              <div className="p-4">
                {children}
              </div>
            </main>
            {/* Courses keep their own sidebar and menu — a signed-off difference —
                but they used to end with no footer at all, which reads as a page
                that failed to finish. Inside the scroll container so it sits below
                the content rather than pinned over it. */}
            <AppFooter />
          </div>
        </div>
        {/* No Toaster here: App mounts the single one. Extra copies each render
            their own viewport, so one toast appeared two or three times over. */}
      </div>

    </SidebarProvider>
  );
}
