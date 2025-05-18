
import React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import Navbar from './Navbar';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';
import { UserPresenceBar } from '@/components/presence/UserPresenceBar';
import { useAuth } from '@/contexts/AuthContext';
import { Outlet } from 'react-router-dom';

export type AppLayoutProps = {
  children?: React.ReactNode;
  fullWidth?: boolean;
};

const AppLayout = ({ children, fullWidth = false }: AppLayoutProps) => {
  const { navigateWithAuth } = useAuthenticatedNavigation();
  const { isAuthenticated } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
          <Navbar />
          {isAuthenticated && <UserPresenceBar />}
          <main className={`flex-1 w-full overflow-auto ${fullWidth ? 'p-0' : 'p-4'}`}>
            {children || <Outlet />}
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
