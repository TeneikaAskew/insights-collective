import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';

/**
 * Rendered by VisibilityGate in place of a page that is hidden for the
 * current user's role. The gated page itself is never mounted.
 */
export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="ss-wash min-h-full flex items-center justify-center px-4 py-16">
        <div className="ss-card bg-card p-10 max-w-md text-center" data-testid="coming-soon">
          <div className="ss-chip rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-3xl font-semibold mb-3">Coming Soon</h2>
          <p className="text-muted-foreground mb-2">
            This page will be available to your account soon.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            If you believe you should have access to this page, please contact
            your administrator.
          </p>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
