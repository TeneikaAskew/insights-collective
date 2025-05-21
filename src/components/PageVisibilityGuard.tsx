
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PageVisibilityGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPageVisible, isLoading } = usePageVisibility();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      setIsVisible(isPageVisible(location.pathname));
    }
  }, [location.pathname, isPageVisible, isLoading]);

  // Navigate back to resources page
  const handleBackToResources = () => {
    navigate('/resources');
  };

  if (isLoading) return <>{children}</>;
  
  if (isVisible) {
    return <>{children}</>;
  }

  // Find the main element by data-component-name
  const applyOverlayToMainContent = () => {
    const mainContent = document.querySelector('[data-component-name="main"]');
    
    if (mainContent) {
      // Only overlay the main content, leaving sidebar visible
      return (
        <>
          {/* Original children rendered normally first */}
          {children}
          
          {/* Overlay applied to the main content area only */}
          <div className="fixed inset-0 pointer-events-none">
            <div className="pointer-events-auto absolute inset-0 left-[var(--sidebar-width,260px)] bg-white/40 dark:bg-black/40 backdrop-blur-md flex items-center justify-center z-[999]">
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
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-4 mb-4">
                  <p>If you believe you should have access to this page, please contact your administrator.</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleBackToResources}
                  className="mt-2"
                >
                  Back to Resources
                </Button>
              </div>
            </div>
          </div>
        </>
      );
    }
    
    // Fallback to rendering just the overlay if main content not found
    return (
      <div className="relative min-h-screen">
        {children}
        <div className="fixed inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-md flex items-center justify-center z-[999] pointer-events-auto">
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
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-4 mb-4">
              <p>If you believe you should have access to this page, please contact your administrator.</p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleBackToResources}
              className="mt-2"
            >
              Back to Resources
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return applyOverlayToMainContent();
}
