
import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useNavigate, useLocation, NavigateFunction, Location } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { useToast } from './use-toast';

export interface EnrichedUser extends User {
  roles?: string[];
  avatar?: string;
  avatar_url?: string;
  name?: string;
}

// Helper to safely get navigation objects outside Router context
const useSafeNavigation = () => {
  let navigate: NavigateFunction | undefined;
  let location: Location | undefined;
  
  try {
    navigate = useNavigate();
    location = useLocation();
  } catch (error) {
    console.warn('Navigation hooks used outside Router context');
  }
  
  return { navigate, location };
};

export const useAuthProvider = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { navigate, location } = useSafeNavigation();
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
    if (!navigate) {
      console.warn('Cannot redirect: navigation not available');
      return;
    }
    
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

      console.log('[useAuth] Auth state changed, new session:', !!newSession);
      setSession(newSession);
    });

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[useAuth] Error getting session:', error);
          setSession(null);
        } else if (data.session) {
          console.log('[useAuth] Session found during initialization');
          setSession(data.session);
        } else {
          console.log('[useAuth] No session found during initialization');
          setSession(null);
        }
      } catch (err) {
        console.error('[useAuth] Unexpected error during getSession:', err);
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      data.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // On profile loaded & authenticated, perform redirect if redirect path set
    if (isAuthenticated && !loading && !profileLoading && redirectPath) {
      console.log('[useAuth] Ready to redirect - isAuthenticated:', isAuthenticated, 'loading:', loading, 'profileLoading:', profileLoading);
      handleRedirectAfterLogin();
    }
  }, [isAuthenticated, loading, profileLoading, redirectPath, handleRedirectAfterLogin]);

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

      // Get the redirect path from localStorage - this should be set before calling socialSignIn
      const redirectPath = localStorage.getItem('redirectAfterLogin') || '/resources';
      
      console.log(`[socialSignIn] Signing in with ${provider}. Redirect path: ${redirectPath}`);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.error(`[socialSignIn] ${provider} sign-in error:`, error);
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    if (!navigate) {
      console.error('Navigation not available, cannot complete registration flow');
      return;
    }
    
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
      console.error('[register] Registration error:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  const logout = useCallback(async () => {
    if (!navigate) {
      console.error('Navigation not available, cannot complete logout flow');
      return;
    }
    
    try {
      await supabase.auth.signOut();
      setSession(null);
      navigate('/');
    } catch (error: any) {
      console.error('[logout] Error during sign out:', error);
      toast({ 
        title: 'Error signing out',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [navigate, toast]);

  useEffect(() => {
    let isMounted = true;

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;

      console.log('[useAuth] Auth state changed, new session:', !!newSession);
      setSession(newSession);
    });

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[useAuth] Error getting session:', error);
          setSession(null);
        } else if (data.session) {
          console.log('[useAuth] Session found during initialization');
          setSession(data.session);
        } else {
          console.log('[useAuth] No session found during initialization');
          setSession(null);
        }
      } catch (err) {
        console.error('[useAuth] Unexpected error during getSession:', err);
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      data.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // On profile loaded & authenticated, perform redirect if redirect path set
    if (isAuthenticated && !loading && !profileLoading && redirectPath && navigate) {
      console.log('[useAuth] Ready to redirect - isAuthenticated:', isAuthenticated, 'loading:', loading, 'profileLoading:', profileLoading);
      handleRedirectAfterLogin();
    }
  }, [isAuthenticated, loading, profileLoading, redirectPath, handleRedirectAfterLogin, navigate]);

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
    isAdmin,
    isAdminAuthenticated,
    storeRedirectPath,
    handleRedirectAfterLogin,
  };
};

export type AuthContextType = ReturnType<typeof useAuthProvider>;

// Export the useAuthProvider function as useAuth
export const useAuth = useAuthProvider;
