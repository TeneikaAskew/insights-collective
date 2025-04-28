import { useState, useEffect, useCallback } from 'react';
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

  const { enrichedUser, loading: profileLoading } = useUserProfile(session?.user ?? null);

  const isAuthenticated = !!enrichedUser;
  
  // Add explicit isAdmin property
  const isAdmin = enrichedUser?.roles?.includes('admin') || false;
  const isAdminAuthenticated = enrichedUser?.roles?.includes('admin');

  // Centralized redirect path state in Auth context
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  const storeRedirectPath = useCallback((path: string) => {
    if (path && !['/login', '/register', '/'].includes(path)) {
      localStorage.setItem('redirectAfterLogin', path);
      setRedirectPath(path);
      console.log('[storeRedirectPath] Stored redirect path:', path);
    } else {
      console.log('[storeRedirectPath] Skipped storing path:', path);
    }
  }, []);

  const handleRedirectAfterLogin = useCallback(() => {
    let redirectTo = redirectPath;

    if (!redirectTo) {
      // fallback to localStorage if state lost (unlikely)
      redirectTo = localStorage.getItem('redirectAfterLogin') || '/dashboard';
      console.log('[handleRedirectAfterLogin] Fallback redirectTo from localStorage:', redirectTo);
    } else {
      console.log('[handleRedirectAfterLogin] RedirectTo from state:', redirectTo);
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
    setRedirectPath(null);
    console.log('[handleRedirectAfterLogin] Redirecting to:', redirectTo);
    navigate(redirectTo, { replace: true });

  }, [navigate, redirectPath, enrichedUser, toast]);

  useEffect(() => {
    let isMounted = true;

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
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
  }, []);

  useEffect(() => {
    // On profile loaded & authenticated, perform redirect if redirect path set
    if (isAuthenticated && !loading && redirectPath) {
      handleRedirectAfterLogin();
    }
  }, [isAuthenticated, loading, redirectPath, handleRedirectAfterLogin]);

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
    isAdmin, // Explicitly include isAdmin property
    isAdminAuthenticated,
    storeRedirectPath,
    handleRedirectAfterLogin,
  };
};

export type AuthContextType = ReturnType<typeof useAuthProvider>;

// Export the useAuthProvider function as useAuth
export const useAuth = useAuthProvider;
