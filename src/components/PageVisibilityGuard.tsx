
import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Clock } from 'lucide-react';

export default function PageVisibilityGuard({ children }) {
  const location = useLocation();
  const { isPageVisible, isLoading } = usePageVisibility();
  const [isVisible, setIsVisible] = useState(true);

  // Memoize the current path to prevent unnecessary re-renders
  const currentPath = useMemo(() => location.pathname, [location.pathname]);

  useEffect(() => {
    // Only update visibility if loading is complete
    if (!isLoading) {
      const visibilityStatus = isPageVisible(currentPath);
      console.log(`[PageVisibilityGuard] Path: ${currentPath}, Visibility: ${visibilityStatus}`);
      setIsVisible(visibilityStatus);
    }
  }, [currentPath, isPageVisible, isLoading]);

  // During loading, just render children to avoid flash
  if (isLoading) return <>{children}</>;
  
  // If page is visible, render children
  if (isVisible) return <>{children}</>;

  // Otherwise, render children with overlay
  return (
    <div className="relative min-h-screen">
      {/* Apply blur and opacity to entire content area */}
      <div className="absolute inset-0 opacity-30 pointer-events-none filter blur-[4px]">
        {children}
      </div>

      {/* Overlay with coming soon message */}
      <div className="fixed inset-0 bg-white/70 backdrop-blur-md flex items-center justify-center z-50">
        <div className="text-center p-8 bg-white/90 rounded-lg shadow-lg max-w-md">
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
