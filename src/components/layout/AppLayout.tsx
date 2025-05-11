
import React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import Navbar from './Navbar';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';

type AppLayoutProps = {
  children: React.ReactNode;
  fullWidth?: boolean;
};

const AppLayout = ({ children, fullWidth = false }: AppLayoutProps) => {
  // Fixed: Use the correct property name from the hook
  const { navigateWithAuth } = useAuthenticatedNavigation();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
          <Navbar />
          <main className={`flex-1 w-full h-full overflow-auto ${fullWidth ? 'p-0' : 'p-4'}`}>
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
