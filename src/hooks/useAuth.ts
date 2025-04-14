
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
    if (path && !['/login', '/register', '/'].includes(path)) {
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
      // Get redirect path with priority order
      const redirectParam = new URLSearchParams(location.search).get('redirect');
      const fromPath = location.state?.from?.pathname;
      const storedRedirect = localStorage.getItem('redirectAfterLogin');

      let redirectTo = '/dashboard'; // Default fallback

      if (redirectParam && !['/login', '/register'].includes(redirectParam)) {
        redirectTo = redirectParam;
      } else if (fromPath && !['/login', '/register'].includes(fromPath)) {
        redirectTo = fromPath;
      } else if (storedRedirect && !['/login', '/register'].includes(storedRedirect)) {
        redirectTo = storedRedirect;
      }

      // Guard admin routes
      if (!enrichedUser?.roles?.includes('admin') && redirectTo.startsWith('/admin')) {
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to access the admin area.',
          variant: 'destructive',
        });
        redirectTo = '/dashboard';
      }

      // Clear the stored redirect path to prevent stale redirects
      localStorage.removeItem('redirectAfterLogin');

      if (process.env.NODE_ENV === 'development') {
        console.log('Redirecting to:', redirectTo);
      }

      // Perform the redirect
      navigate(redirectTo, { replace: true });
    } finally {
      // Reset the redirect flag after a delay
      setTimeout(() => {
        redirectInProgressRef.current = false;
      }, 100);
    }
  }, [navigate, location, enrichedUser, toast]);

  // Handle Supabase auth state changes
  useEffect(() => {
    let isMounted = true;

    // Set up the auth state listener FIRST before checking the current session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (process.env.NODE_ENV === 'development') {
        console.log('Auth state changed:', event, !!newSession);
      }

      if (event === 'SIGNED_IN') {
        setSession(newSession);
        toast({ title: 'Success', description: 'Logged in successfully' });
        
        // Set flag to trigger redirect once user data is loaded
        awaitingRedirectRef.current = true;
        
        // Attempt immediate redirect
        setTimeout(() => {
          if (isMounted && !redirectInProgressRef.current) {
            handleRedirectAfterLogin();
          }
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        localStorage.removeItem('redirectAfterLogin');
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
      }
    });

    // THEN check for existing session
    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setSession(null);
        } else if (data.session) {
          setSession(data.session);
          
          // Check if we need to redirect after recovering a session
          if (awaitingRedirectRef.current && !redirectInProgressRef.current) {
            setTimeout(() => {
              if (isMounted) handleRedirectAfterLogin();
            }, 0);
          }
        } else {
          setSession(null);
        }
      } catch (err) {
        console.error('Session initialization error:', err);
        setSession(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [toast, handleRedirectAfterLogin]);

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
        options: { redirectTo: `${window.location.origin}/auth/callback` },
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
