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

  const isAuthenticated = !!enrichedUser;
  const isAdminAuthenticated = enrichedUser?.roles?.includes('admin');

  const storeRedirectPath = useCallback((path: string) => {
    if (path && !['/login', '/register', '/'].includes(path)) {
      localStorage.setItem('redirectAfterLogin', path);
      console.log('[storeRedirectPath] Stored redirect path:', path);
    } else {
      console.log('[storeRedirectPath] Skipped storing path:', { path, alreadyStored });
    }
  }, []);

  const handleRedirectAfterLogin = useCallback(() => {
    if (redirectInProgressRef.current) {
      console.log('[handleRedirectAfterLogin] Skipped: redirect already in progress');
      return;
    }

    redirectInProgressRef.current = true;
    console.log('[handleRedirectAfterLogin] Triggered');

    try {
      const redirectParam = new URLSearchParams(location.search).get('redirect');
      const fromPath = location.state?.from?.pathname;
      const storedRedirect = localStorage.getItem('redirectAfterLogin');

      let redirectTo = storedRedirect || redirectParam || fromPath || '/dashboard';

      console.log('[handleRedirectAfterLogin] Decision tree:', {
        storedRedirect,
        redirectParam,
        fromPath,
        fallback: '/dashboard',
        redirectTo,
        currentPath: location.pathname,
        enrichedUser,
      });

      if (!enrichedUser?.roles?.includes('admin') && redirectTo.startsWith('/admin')) {
        console.warn('[handleRedirectAfterLogin] User blocked from admin route:', redirectTo);
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to access the admin area.',
          variant: 'destructive',
        });
        redirectTo = '/dashboard';
      }

      localStorage.removeItem('redirectAfterLogin');
      console.log('[handleRedirectAfterLogin] Redirecting to:', redirectTo);

      navigate(redirectTo, { replace: true });
    } finally {
      setTimeout(() => {
        redirectInProgressRef.current = false;
        console.log('[handleRedirectAfterLogin] Redirect complete, reset flag');
      }, 100);
    }
  }, [navigate, location, enrichedUser, toast]);

  useEffect(() => {
    let isMounted = true;

    const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      console.log('[onAuthStateChange] Event:', event, 'Session:', newSession);

      if (event === 'SIGNED_IN') {
        setSession(newSession);
        awaitingRedirectRef.current = true;
        toast({ title: 'Success', description: 'Logged in successfully' });
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        localStorage.removeItem('redirectAfterLogin');
        console.log('[onAuthStateChange] Signed out and cleared redirect');
      }
    });

    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      console.log('[init] Supabase session:', data.session, 'Error:', error);

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
      console.log('[cleanup] Unsubscribed from auth listener');
    };
  }, [toast]);

  useEffect(() => {
    if (awaitingRedirectRef.current && isAuthenticated && !loading) {
      console.log('[useEffect] Awaiting redirect now triggering...');
      handleRedirectAfterLogin();
      awaitingRedirectRef.current = false;
    }
  }, [isAuthenticated, loading, handleRedirectAfterLogin]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('[login] Attempting login:', email);

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
      console.log('[socialSignIn] Triggering for provider:', provider);

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
      console.log('[register] Registering new user:', email);

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
    console.log('[logout] Signing out...');
    await supabase.auth.signOut();
    setSession(null);
    navigate('/');
  }, [navigate]);

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
    isAuthenticated,
    isAdminAuthenticated,
    storeRedirectPath,
    handleRedirectAfterLogin,
  };
};

export type AuthContextType = ReturnType<typeof useAuthProvider>;
