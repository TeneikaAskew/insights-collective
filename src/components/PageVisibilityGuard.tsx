
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
      // Clean the path by removing query parameters and hash
      const pathWithoutParams = location.pathname.split('?')[0].split('#')[0];
      const visible = isPageVisible(pathWithoutParams);
      
      // Set state and log for debugging
      setIsVisible(visible);
      console.log(`[PageVisibilityGuard] Path: ${pathWithoutParams}, visible: ${visible}`);
    }
  }, [location.pathname, isPageVisible, isLoading]);

  // While loading, show the original content
  if (isLoading) return <>{children}</>;
  
  // If the page should be visible, show the original content
  if (isVisible) return <>{children}</>;

  return (
    <div className="relative min-h-screen">
      {/* Completely hide the original content instead of blurring it */}
      <div className="hidden">
        {children}
      </div>

      {/* Overlay with "Coming Soon" message */}
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center p-8 bg-white/90 rounded-lg shadow-lg max-w-md animate-in fade-in border-2 border-primary/20">
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
