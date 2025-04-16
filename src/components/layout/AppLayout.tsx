
import React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import Navbar from './Navbar';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';
import { useStoreRedirectPath } from '@/hooks/useStoreRedirectPath';

type AppLayoutProps = {
  children: React.ReactNode;
};

const AppLayout = ({ children }: AppLayoutProps) => {
  // Use authenticated navigation
  const { navigateWithAuth } = useAuthenticatedNavigation();
  
  // Use store redirect path to capture navigation
  useStoreRedirectPath();
  
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-auto p-4">
            {children}
          </main>
          <footer className="p-4 border-t text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Insights Collective. All rights reserved.
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
