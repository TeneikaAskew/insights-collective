
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Shield, LockIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  if (isVisible) return <>{children}</>;

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Render the original content with blur and pointer-events disabled */}
      <div className="absolute inset-0 w-full h-full opacity-30 pointer-events-none filter blur-md">
        {children}
      </div>

      {/* Overlay with "Restricted Access" message */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[999]">
        <div className="text-center p-8 bg-card rounded-lg shadow-lg max-w-md animate-in fade-in-0 slide-in-from-bottom-5 duration-300">
          <div className="bg-primary/10 w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center">
            <LockIcon className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Restricted Access
          </h2>
          <p className="text-muted-foreground mb-6">
            This page is restricted for your access level. Please contact your administrator if you believe you should have access.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Access restricted by admin</span>
          </div>
          <Button 
            variant="outline" 
            className="mt-6" 
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
