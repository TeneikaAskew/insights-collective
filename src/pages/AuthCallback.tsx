
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/resources';

  useEffect(() => {
    // Store the redirect path and let auth system handle it
    if (redirect && redirect !== '/dashboard') {
      localStorage.setItem('redirectAfterLogin', redirect);
    }
    
    // Short delay to ensure any auth state changes are processed
    const timer = setTimeout(() => {
      console.log('[AuthCallback] Redirecting to:', redirect);
      navigate(redirect, { replace: true });
    }, 300);

    return () => clearTimeout(timer);
  }, [navigate, redirect]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <h1 className="text-2xl font-semibold">Finishing authentication...</h1>
      <p className="text-muted-foreground">You will be redirected shortly</p>
    </div>
  );
};

export default AuthCallback;
