import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import Navbar from './Navbar';
import { UserPresenceBar } from '@/components/presence/UserPresenceBar';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

type AppLayoutProps = {
  children: React.ReactNode;
  fullWidth?: boolean;
};

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

const AppLayout = ({ children, fullWidth = false }: AppLayoutProps) => {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const cookieName = useMemo(() => 'app-sidebar:state', []);

  const isInterviewPrepPage = [
    '/interview-prep/code-practice',
    '/interview-prep/star-practice',
    '/interview-prep/job-description',
    '/interview-prep/mock-interviews'
  ].some(path => location.pathname.includes(path));
  const routeContext = isInterviewPrepPage ? 'app-sidebar-default-closed' : 'app-sidebar-persistent';
  const previousRouteContextRef = useRef(routeContext);

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    isInterviewPrepPage ? false : readSidebarCookie(cookieName, false)
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (previousRouteContextRef.current === routeContext) {
      return;
    }

    setSidebarOpen(isInterviewPrepPage ? false : readSidebarCookie(cookieName, false));
    setMobileSidebarOpen(false);
    previousRouteContextRef.current = routeContext;
  }, [cookieName, isInterviewPrepPage, routeContext]);

  const handleSidebarOpenChange = useCallback((open: boolean) => {
    setSidebarOpen(open);

    if (!isInterviewPrepPage) {
      writeSidebarCookie(cookieName, open);
    }
  }, [cookieName, isInterviewPrepPage]);

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={handleSidebarOpenChange}
      mobileOpen={mobileSidebarOpen}
      onMobileOpenChange={setMobileSidebarOpen}
    >
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
          <Navbar />
          {/* Only show UserPresenceBar for admin users */}
          {isAuthenticated && isAdmin && <UserPresenceBar />}
          <main data-component-name="main" className={`flex-1 w-full overflow-auto ${fullWidth ? 'p-0' : 'p-4'}`}>
            {children}
          </main>
          <footer className="p-4 w-full border-t text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Insights Collective. All rights reserved.
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
