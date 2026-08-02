import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import AppLayout from '@/components/layout/AppLayout';

import { createLogger } from '@/utils/logger';

const logger = createLogger('NotFound');

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  // Wrapped in the app shell, like ComingSoon is. A 404 rendered bare drops the
  // sidebar and navbar, so a mistyped URL looked like being signed out rather than
  // like one missing page — and the only way back was the single link below.
  //
  // min-h-screen becomes h-full: inside the shell, the container is already the
  // height of the viewport minus navbar and footer, so min-h-screen overflowed it
  // and pushed the footer off the bottom.
  return (
    <AppLayout>
      <div
        data-testid="not-found"
        className="h-full flex items-center justify-center bg-background"
      >
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p className="text-xl text-muted-foreground mb-4">Oops! Page not found</p>
          <Link to="/" className="text-primary hover:text-ss-lav-deep underline">
            Return to Home
          </Link>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotFound;
