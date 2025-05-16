
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Clock, Lock } from 'lucide-react';

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
      {/* Render the original content with blur and pointer-events disabled */}
      <div className="opacity-20 pointer-events-none filter blur-[3px]">
        {children}
      </div>

      {/* Overlay with "Access Restricted" message */}
      <div className="fixed inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-md flex items-center justify-center z-[999]">
        <div className="text-center p-8 bg-white/80 dark:bg-gray-900/80 rounded-lg shadow-2xl max-w-md animate-fade-in border border-gray-200 dark:border-gray-700">
          <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">
            Access Restricted
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            This page is not available for your current access level.
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            <p>If you believe you should have access to this page, please contact your administrator.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
