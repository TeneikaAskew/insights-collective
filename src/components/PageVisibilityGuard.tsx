import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Clock } from 'lucide-react';

export default function PageVisibilityGuard({ children }) {
  const location = useLocation();
  const { isPageVisible, isLoading } = usePageVisibility();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Only update visibility if loading is complete
    if (!isLoading) {
      const visibilityStatus = isPageVisible(location.pathname);
      setIsVisible(visibilityStatus);
    }
  }, [location.pathname, isPageVisible, isLoading]);

  // During loading, just render children to avoid flash
  if (isLoading) return <>{children}</>;
  
  // If page is visible, render children
  if (isVisible) return <>{children}</>;

  // Otherwise, render children with overlay
  return (
    <div className="relative min-h-screen">
      <div className="opacity-50 pointer-events-none filter blur-[2px]">
        {children}
      </div>

      <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center p-8 bg-white/80 rounded-lg shadow-lg max-w-md">
          <Clock className="mx-auto h-16 w-16 text-primary mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-primary mb-2">
            Coming Soon
          </h2>
          <p className="text-gray-700">
            This page isn't available yet. Check back later for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
