import { Outlet, useLocation } from 'react-router-dom';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { isUngatedPath } from '@/config/pageManifest';
import ComingSoon from '@/pages/ComingSoon';
import VisibilityUnavailable from '@/pages/VisibilityUnavailable';

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
  const { isPageVisible, isReady, loadError, retry } = usePageVisibility();

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

  // A failed visibility fetch also hides every managed page (isPageVisible
  // fails closed for non-admins), but it must not SAY the same thing a
  // deliberate toggle says. It did: an outage rendered "This page will be
  // available to your account soon — contact your administrator", so a database
  // or RLS failure was indistinguishable from an admin decision, on every page
  // at once including the public landing page, and it blamed the reader's
  // account for it. Measured directly: with the visibility query failing, all 41
  // routes rendered that card. Same fail-closed behaviour, honest wording.
  if (loadError) {
    return <VisibilityUnavailable onRetry={retry} />;
  }

  return isPageVisible(location.pathname) ? <Outlet /> : <ComingSoon />;
}
