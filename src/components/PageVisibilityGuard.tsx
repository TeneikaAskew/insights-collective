
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
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Hide the original content with strong blur */}
      <div className="absolute inset-0 opacity-30 pointer-events-none filter blur-md">
        {children}
      </div>

      {/* Overlay with "Coming Soon" message */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
        <div className="text-center p-8 bg-white/90 rounded-lg shadow-xl max-w-md animate-fade-in">
          <Clock className="mx-auto h-16 w-16 text-primary mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-primary mb-2">
            Coming Soon
          </h2>
          <p className="text-gray-700 mb-4">
            This page isn't available yet. Please check back later for updates.
          </p>
          <div className="text-sm text-gray-500">
            If you think this is an error, please contact your administrator.
          </div>
        </div>
      </div>
    </div>
  );
}
