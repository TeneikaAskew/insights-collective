import { Outlet, useLocation } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { isUngatedPath } from '@/config/pageManifest';
import ComingSoon from '@/pages/ComingSoon';

/**
 * Pathless layout route that enforces page visibility for every route
 * nested under it. Unlike the old PageVisibilityGuard — which mounted the
 * hidden page behind a CSS blur, letting all of its queries and effects
 * run — this gate never renders the route element at all unless the page
 * is visible: hidden pages get a Coming Soon page and loading a spinner,
 * so a gated page's code cannot execute for a user who may not see it.
 */
export default function VisibilityGate() {
  const location = useLocation();
  const { isPageVisible, isReady } = usePageVisibility();

  // Defensive: ungated surfaces render even if this gate ever wraps them
  if (isUngatedPath(location.pathname)) {
    return <Outlet />;
  }

  // Fail closed while auth + visibility data load — nothing mounts,
  // nothing flashes
  if (!isReady) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return isPageVisible(location.pathname) ? <Outlet /> : <ComingSoon />;
}
