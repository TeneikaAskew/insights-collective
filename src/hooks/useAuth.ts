import { useState, useEffect, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { useToast } from './use-toast';

export const useAuthProvider = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const redirectInProgressRef = useRef(false);
  const awaitingRedirectRef = useRef(false);

  const { enrichedUser, loading: profileLoading } = useUserProfile(session?.user ?? null);

  const storeRedirectPath = useCallback((path: string) => {
    const alreadyStored = localStorage.getItem('redirectAfterLogin');
    
    if (
      !alreadyStored && // ✅ Only store if nothing is already there
      path &&
      !['/login', '/register', '/'].includes(path)
    ) {
      localStorage.setItem('redirectAfterLogin', path);
      if (process.env.NODE_ENV === 'development') {
        console.log('Stored redirect path:', path);
      }
    }
  }, []);

  const handleRedirectAfterLogin = useCallback(() => {
    if (redirectInProgressRef.current) return;
    redirectInProgressRef.current = true;

    try {
      const redirectParam = new URLSearchParams(location.search).get('redirect');
      const fromPath = location.state?.from?.pathname;
      const storedRedirect = localStorage.getItem('redirectAfterLogin');

      let redirectTo = '/dashboard';

      if (redirectParam && !['/login', '/register'].includes(redirectParam)) {
        redirectTo = redirectParam;
      } else if (fromPath && !['/login', '/register'].includes(fromPath)) {
        redirectTo = fromPath;
      } else if (storedRedirect && !['/login', '/register'].includes(storedRedirect)) {
        redirectTo = storedRedirect;
      }

      if (!enrichedUser?.roles?.includes('admin') && redirectTo.startsWith('/admin')) {
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to access the admin area.',
          variant: 'destructive',
        });
        redirectTo = '/dashboard';
      }

      localStorage.removeItem('redirectAfterLogin');

      if (process.env.NODE_ENV === 'development') {
        console.log('Redirecting to:', redirectTo);
      }

      navigate(redirectTo, { replace: true });
    } finally {
      setTimeout(() => {
        redirectInProgressRef.current = false;
      }, 100);
    }
  }, [navigate, location, enrichedUser, toast]);

  useEffect(() => {
    // Wait for user state to be restored and redirect will occur in useAuth
  }, []);

  useEffect(() => {
    let isMounted = true;

    const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN') {
        setSession(newSession);
        toast({ title: 'Success', description: 'Logged in successfully' });
        awaitingRedirectRef.current = true;
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        localStorage.removeItem('redirectAfterLogin');
      }
    });

    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setSession(null);
      } else {
        setSession(data.session);
      }

      setLoading(false);
    };

    init();

    return () => {
      isMounted = false;
      data.subscription?.unsubscribe();
    };
  }, [toast]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: any) {
      setError(error.message);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const socialSignIn = useCallback(async (provider: 'google' | 'github' | 'twitter') => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(localStorage.getItem('redirectAfterLogin') || '/dashboard')}`
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: name.split(' ')[0],
            last_name: name.split(' ').slice(1).join(' '),
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Account created successfully. Please check your email.',
      });

      navigate('/login');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    navigate('/');
  }, [navigate]);

  const isAdminAuthenticated = enrichedUser?.roles?.includes('admin');

  return {
    session,
    user: enrichedUser,
    loading: loading || profileLoading,
    error,
    login,
    register,
    logout,
    googleSignIn: () => socialSignIn('google'),
    githubSignIn: () => socialSignIn('github'),
    twitterSignIn: () => socialSignIn('twitter'),
    isAuthenticated: !!enrichedUser,
    isAdminAuthenticated,
    storeRedirectPath,
    handleRedirectAfterLogin,
  };
};

export type AuthContextType = ReturnType<typeof useAuthProvider>;
