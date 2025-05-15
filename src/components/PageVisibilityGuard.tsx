
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Clock } from 'lucide-react';

export default function PageVisibilityGuard({ children }) {
  const location = useLocation();
  const { isPageVisible, isLoading } = usePageVisibility();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      setIsVisible(isPageVisible(location.pathname));
    }
  }, [location.pathname, isPageVisible, isLoading]);

  if (isLoading) return <>{children}</>;
  if (isVisible) return <>{children}</>;

  return (
    <div className="relative min-h-screen">
      {/* Render the original content with strong blur and low opacity */}
      <div className="opacity-20 pointer-events-none filter blur-md absolute inset-0 overflow-hidden">
        {children}
      </div>

      {/* Overlay with "Coming Soon" message */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50">
        <div className="text-center p-8 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-xl max-w-md animate-in fade-in duration-500">
          <Clock className="mx-auto h-16 w-16 text-primary mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-primary mb-2">
            Access Restricted
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            This page isn't available to your user role yet. Please contact an administrator for access.
          </p>
        </div>
      </div>
    </div>
  );
}
