
import React, { useEffect } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import Navbar from './Navbar';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';
import { UserPresenceBar } from '@/components/presence/UserPresenceBar';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

type AppLayoutProps = {
  children: React.ReactNode;
  fullWidth?: boolean;
};

const AppLayout = ({ children, fullWidth = false }: AppLayoutProps) => {
  const { navigateWithAuth } = useAuthenticatedNavigation();
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  
  // Check if the current path is one of the interview prep pages
  const isInterviewPrepPage = [
    '/interview-prep/code-practice',
    '/interview-prep/star-practice',
    '/interview-prep/job-description',
    '/interview-prep/mock-interviews'
  ].some(path => location.pathname.includes(path));
  
  // Default sidebar state - closed for interview prep pages
  const defaultOpen = !isInterviewPrepPage;

  return (
    <SidebarProvider defaultOpen={defaultOpen} key={`sidebar-${isInterviewPrepPage}`}>
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
