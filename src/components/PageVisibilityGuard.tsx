
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('PageVisibilityGuard');

export default function PageVisibilityGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPageVisible, isLoading } = usePageVisibility();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [checkComplete, setCheckComplete] = useState(false);

  useEffect(() => {
    // Check page visibility on every location change or when the context data loads
    const checkVisibility = async () => {
      try {
        if (!isLoading) {
          const pathToCheck = location.pathname;
          logger.log(`[PageVisibilityGuard] Checking visibility for path: ${pathToCheck}`);
          logger.log(`[PageVisibilityGuard] User:`, user);
          
          const visibility = isPageVisible(pathToCheck);
          logger.log(`[PageVisibilityGuard] Path ${pathToCheck} is visible: ${visibility}`);
          
          setIsVisible(visibility);
          setCheckComplete(true);
        }
      } catch (error) {
        logger.error('[PageVisibilityGuard] Error checking visibility:', error);
        // Default to visible on error to prevent blocking
        setIsVisible(true);
        setCheckComplete(true);
      }
    };
    
    checkVisibility();
  }, [location.pathname, isPageVisible, isLoading, user]);

  // Navigate back to resources page
  const handleBackToResources = () => {
    navigate('/resources');
  };

  // Shorter loading timeout to prevent infinite loading
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        logger.warn('[PageVisibilityGuard] Loading timeout, defaulting to visible');
        setIsVisible(true);
        setCheckComplete(true);
      }, 2000); // 2 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  // During loading state, show a minimal loading indicator instead of full page blur
  if (isLoading && !checkComplete) {
    logger.log('[PageVisibilityGuard] Still loading visibility data...');
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // If visible, show the content normally
  if (isVisible) {
    logger.log('[PageVisibilityGuard] Page is visible, showing content');
    return <>{children}</>;
  }

  logger.log('[PageVisibilityGuard] Page not visible, showing overlay');

  // Apply overlay directly - don't rely on DOM element queries which can be unreliable
  return (
    <div className="relative min-h-screen">
      {/* Render the original page in the background but with no interactivity */}
      <div className="pointer-events-none opacity-20 blur-sm">
        {children}
      </div>
      
      {/* Overlay with Coming Soon message */}
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
}
