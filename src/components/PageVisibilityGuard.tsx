
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Clock } from 'lucide-react';

interface PageVisibilityGuardProps {
  children: React.ReactNode;
}

const PageVisibilityGuard: React.FC<PageVisibilityGuardProps> = ({ children }) => {
  const location = useLocation();
  useEffect(() => {
    const path = window.location.pathname + window.location.search;
    const alreadyStored = localStorage.getItem('redirectAfterLogin');
    const isAuthPage = ['/login', '/register'].includes(location.pathname);

    if (!alreadyStored && !isAuthPage) {
      localStorage.setItem('redirectAfterLogin', path);
      if (process.env.NODE_ENV === 'development') {
        console.log('[PageVisibilityGuard] Stored redirectAfterLogin:', path);
      }
    }
  }, [location]);
  
  const { isPageVisible, isLoading } = usePageVisibility();
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    if (!isLoading) {
      setIsVisible(isPageVisible(location.pathname));
    }
  }, [location.pathname, isPageVisible, isLoading]);

  // If the page is still loading visibility data, show the content
  if (isLoading) {
    return <>{children}</>;
  }

  // If the page is visible, render normally
  if (isVisible) {
    return <>{children}</>;
  }

  // If the page is not visible, render with the overlay
  return (
    <div className="relative min-h-screen">
      {/* Render the page content, but make it non-interactive */}
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      
      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
        <div className="text-center p-8 rounded-lg max-w-md">
          <Clock className="mx-auto h-16 w-16 text-primary mb-4" />
          <h2 className="text-2xl font-bold text-primary mb-2">Coming Soon</h2>
          <p className="text-gray-700">
            This page isn't available yet. Check back later for updates.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PageVisibilityGuard;
