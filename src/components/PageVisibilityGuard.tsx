
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

  /**
   * Instead of wrapping everything, we need to find the main content area.
   * The AppLayout structure has the sidebar and main content as siblings.
   * We'll render the children normally, then use CSS to target only the main content for the overlay.
   */
  return (
    <>
      {children}
      
      {/* 
        This overlay will be positioned to cover only the main content area 
        using a selector for data-component-name="main"
      */}
      <style jsx global>{`
        [data-component-name="main"] {
          position: relative;
        }
      `}</style>
      
      <div 
        className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-md flex items-center justify-center z-[999]"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'all',
        }}
      >
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
    </>
  );
}
