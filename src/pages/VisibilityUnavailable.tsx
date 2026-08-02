import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';

/**
 * Rendered by VisibilityGate when the page-visibility fetch FAILED, as opposed
 * to succeeding and reporting the page hidden (that is ComingSoon's job).
 *
 * The distinction is the whole point. Access control still fails closed here —
 * nothing gated mounts — but an outage now reads as an outage. Before this, a
 * dead database rendered "This page will be available to your account soon,
 * contact your administrator" on every managed page at once, which told the
 * reader their account lacked access and pointed them at an admin who had done
 * nothing.
 */
export default function VisibilityUnavailable({ onRetry }: { onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <AppLayout fullWidth>
      <div className="ss-wash min-h-full flex items-center justify-center px-4 py-16">
        <div className="ss-card bg-card p-10 max-w-md text-center" data-testid="visibility-unavailable">
          <div className="ss-chip rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-3xl font-semibold mb-3">We're having trouble loading</h2>
          <p className="text-muted-foreground mb-2">
            We couldn't load your settings, so pages are hidden until we can confirm
            what you have access to.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            This is a problem on our end, not with your account. Trying again usually
            sorts it out.
          </p>
          <Button variant="outline" onClick={handleRetry} disabled={retrying}>
            {retrying ? 'Retrying…' : 'Try again'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
