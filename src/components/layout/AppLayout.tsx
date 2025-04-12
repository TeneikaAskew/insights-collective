
import React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import Navbar from './Navbar';

type AppLayoutProps = {
  children: React.ReactNode;
};

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-white to-gray-50">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
          <footer className="p-4 text-center text-sm text-muted-foreground border-t border-gray-100">
            <p>© {new Date().getFullYear()} Insights Collective. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
