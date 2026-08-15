import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import Navbar from './Navbar';
import AppFooter from '@/components/layout/AppFooter';
import RoleLoadWarning from './RoleLoadWarning';
import { useLocation } from 'react-router-dom';
import { readSidebarCookie, writeSidebarCookie } from '@/lib/sidebarCookie';

type AppLayoutProps = {
  children: React.ReactNode;
  fullWidth?: boolean;
};


const AppLayout = ({ children, fullWidth = false }: AppLayoutProps) => {
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
      {/* Dynamic viewport height, with h-screen as the no-dvh fallback: 100vh on
          mobile includes the region behind dynamic browser/webview chrome, so the
          app box — and the footer pinned to its bottom — disagreed with the
          visible viewport and left a dead band under the footer on every page.
          The supports- variant is load-bearing: utility precedence follows
          GENERATED STYLESHEET order, not className order, and the compiled sheet
          emits .h-dvh before .h-screen — so a bare "h-screen h-dvh" resolves to
          100vh everywhere and fixes nothing (verified in dist/assets/*.css).
          Wrapping the dvh rule in @supports places it after the base utilities,
          so it wins exactly where the unit exists. */}
      <div className="flex h-screen supports-[height:100dvh]:h-dvh w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
          <Navbar />
          <RoleLoadWarning />
          {/* The scroll container wraps main AND the footer — CourseLayout's
              signed-off structure — so the footer sits below the content rather
              than pinned over it. Pinned, it permanently spent ~3.5rem of every
              phone screen and — because it hugged the app box's bottom edge —
              drew a border above whatever dead band a webview's dvh
              disagreement leaves, which read as one enormous footer.

              The footer stays a SIBLING of <main>, never a child: a <footer>
              nested inside <main> stops being the page's contentinfo landmark,
              so screen-reader landmark navigation would lose it. As a sibling
              it also spans the full width without gutter-cancelling margins.

              e2e reads this element's scrollTop by its data-component-name
              (dashboard.spec.ts) — rename both together. */}
          <div
            data-component-name="main-scroll"
            className="flex-1 flex flex-col overflow-auto"
          >
            <main data-component-name="main" className={`flex-1 w-full ${fullWidth ? 'p-0' : 'p-4'}`}>
              {children}
            </main>
            <AppFooter />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
