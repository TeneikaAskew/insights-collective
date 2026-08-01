// ABOUTME: Shell banner shown when the roles/profile fetch failed, so a user
// ABOUTME: silently demoted to the student view is told why rather than left guessing.

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

/**
 * When `get_user_roles` fails, useUserProfile falls back to `['student']`. That
 * is the right call — failing closed on permissions is safer than failing open
 * — and the hook has always recorded the failure in its error state.
 *
 * What it did not have was a reader. The audit found ZERO consumers of
 * `useAuth().error`, so an instructor or admin whose roles failed to load saw a
 * student's app: navigation entries gone, management pages gone, no explanation,
 * nothing broken-looking enough to report. The fallback was invisible by design
 * and invisible in practice.
 *
 * This is the reader. Dismissible, because a user who understands the situation
 * should not have to keep looking at it, and re-appearing on the next failed
 * load because the condition is still true.
 */
export function RoleLoadWarning() {
  const { isAuthenticated, profileError } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!isAuthenticated || !profileError || dismissed) return null;

  return (
    <div
      role="status"
      data-testid="role-load-warning"
      // ss-warn tokens rather than a raw palette class: they are already defined
      // for both themes (src/index.css), which a bg-amber-50 banner would not be.
      className="flex items-start gap-3 border-b bg-ss-warn-chip px-4 py-3 text-sm text-ss-peach-deep"
    >
      <AlertTriangle className="h-4 w-4 flex-none mt-0.5" aria-hidden />
      <p className="flex-1 leading-relaxed">
        We couldn't load your account's permissions, so you may be seeing fewer
        features than you have access to. Reloading usually fixes it — if it keeps
        happening, let your administrator know.
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-none"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default RoleLoadWarning;
