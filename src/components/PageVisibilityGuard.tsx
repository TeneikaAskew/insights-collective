
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Lock } from 'lucide-react';

export default function PageVisibilityGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isPageVisible, isLoading } = usePageVisibility();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      setIsVisible(isPageVisible(location.pathname));
    }
  }, [location.pathname, isPageVisible, isLoading]);

  if (isLoading) return <>{children}</>;
  
  if (isVisible) {
    return <>{children}</>;
  }

  // We need to preserve the layout structure including the sidebar
  // The AppLayout component structure has a sidebar as a sibling to the main content
  // We should only apply the overlay to the main content which is passed as children
  return (
    <>
      {/* 
        Return the children without modification to preserve the layout structure,
        but we'll wrap the content in a relative container to position our overlay correctly
      */}
      <div className="contents relative">
        {children}
        
        {/* 
          Create an absolutely positioned overlay that only covers the main content area
          This ensures the sidebar remains visible and interactive
        */}
        <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-md flex items-center justify-center z-[999]">
          <div className="text-center p-8 bg-white/80 dark:bg-gray-900/80 rounded-lg shadow-2xl max-w-md animate-fade-in border border-gray-200 dark:border-gray-700">
            <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-primary mb-2">
              Coming Soon
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              This page will be available to your account soon.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              <p>If you believe you should have access to this page, please contact your administrator.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
