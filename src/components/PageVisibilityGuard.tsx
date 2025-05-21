
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

  return (
    <>
      {/* Include the children but apply styling dynamically to target main content */}
      {children}
      
      <style>
        {`
          [data-component-name="main"] {
            position: relative;
            filter: blur(3px);
            opacity: 0.2;
            pointer-events: none;
          }
          
          .page-visibility-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 999;
            background-color: rgba(255, 255, 255, 0.4);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}
      </style>
      
      {/* Overlay with "Coming Soon" message that attaches to the main content */}
      <div id="page-visibility-overlay-script">
        {/* This script ensures the overlay attaches to the main content */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const mainElement = document.querySelector('[data-component-name="main"]');
                if (mainElement) {
                  const overlay = document.createElement('div');
                  overlay.className = 'page-visibility-overlay';
                  overlay.innerHTML = \`
                    <div class="text-center p-8 bg-white/80 dark:bg-gray-900/80 rounded-lg shadow-2xl max-w-md animate-fade-in border border-gray-200 dark:border-gray-700">
                      <div class="rounded-full bg-gray-100 dark:bg-gray-800 p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-8 w-8 text-primary"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                      </div>
                      <h2 class="text-2xl font-bold text-primary mb-2">
                        Coming Soon
                      </h2>
                      <p class="text-gray-700 dark:text-gray-300 mb-4">
                        This page will be available to your account soon.
                      </p>
                      <div class="text-sm text-gray-500 dark:text-gray-400 mt-4">
                        <p>If you believe you should have access to this page, please contact your administrator.</p>
                      </div>
                    </div>
                  \`;
                  
                  // Set overlay to match the main element's size and position
                  mainElement.style.position = 'relative';
                  mainElement.appendChild(overlay);
                }
              })();
            `,
          }}
        />
      </div>
    </>
  );
}
