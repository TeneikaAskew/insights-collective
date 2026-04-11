
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

import { createLogger } from '@/utils/logger';

const logger = createLogger('AuthCallback');

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/resources';
  const [error, setError] = useState<string | null>(null);
  const [takingLonger, setTakingLonger] = useState(false);

  // Surface OAuth errors returned by the provider (e.g. invalid redirect URI)
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const oauthError =
      searchParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error_description') ||
      hashParams.get('error');
    if (oauthError) {
      logger.error('[AuthCallback] OAuth provider returned error:', oauthError);
      setError(oauthError);
    }
  }, [searchParams]);

  useEffect(() => {
    if (error) return;

    if (redirect && redirect !== '/dashboard') {
      localStorage.setItem('redirectAfterLogin', redirect);
    }

    let navigated = false;
    const goHome = (target: string) => {
      if (navigated) return;
      navigated = true;
      logger.log('[AuthCallback] Redirecting to:', target);
      navigate(target, { replace: true });
    };

    // Listen for the session being established by Supabase after it processes
    // the OAuth callback URL. This avoids a race where we navigate away before
    // the session is ready.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      logger.log('[AuthCallback] auth state changed:', event, !!session);
      if (session) {
        goHome(redirect);
      }
    });

    // If the session is already available (e.g. refresh), redirect immediately.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        goHome(redirect);
      }
    });

    // After 8s with no session event, show a softer "still working" hint with
    // a manual retry. We intentionally do NOT mark the flow as failed — slow
    // networks or providers can legitimately take longer, and Supabase may
    // still complete the handshake after this point.
    const hintTimer = setTimeout(() => {
      if (!navigated) {
        logger.warn('[AuthCallback] Session still pending after 8s');
        setTakingLonger(true);
      }
    }, 8000);

    return () => {
      authListener.subscription?.unsubscribe();
      clearTimeout(hintTimer);
    };
  }, [navigate, redirect, error]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Sign-in failed</h1>
        <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
        <Button onClick={() => navigate('/login', { replace: true })}>Back to login</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <h1 className="text-2xl font-semibold">Finishing authentication...</h1>
      <p className="text-muted-foreground">You will be redirected shortly</p>
      {takingLonger && (
        <div className="mt-6 max-w-md">
          <p className="text-sm text-muted-foreground mb-3">
            This is taking longer than usual. You can keep waiting, or try signing in again.
          </p>
          <Button variant="outline" onClick={() => navigate('/login', { replace: true })}>
            Back to login
          </Button>
        </div>
      )}
    </div>
  );
};

export default AuthCallback;
