
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { createLogger } from '@/utils/logger';

const logger = createLogger('PageVisibilityGuard');

export default function PageVisibilityGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPageVisible, isReady } = usePageVisibility();

  const handleBackToResources = () => {
    navigate('/resources');
  };

  // While auth + visibility data are still loading, show a small spinner (fail-closed)
  if (!isReady) {
    logger.log('[PageVisibilityGuard] Not ready yet, showing loader');
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const visible = isPageVisible(location.pathname);
  logger.log(`[PageVisibilityGuard] Path ${location.pathname} visible: ${visible}`);

  if (visible) {
    return <>{children}</>;
  }

  // Show the Coming Soon overlay
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none opacity-20 blur-sm">
        {children}
      </div>

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
