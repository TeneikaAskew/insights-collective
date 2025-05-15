
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { useToast } from './use-toast';

export const useAuthProvider = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const { enrichedUser, loading: profileLoading } = useUserProfile(session?.user ?? null);

  // Derived state values
  const isAuthenticated = !!enrichedUser;
  const isAdmin = enrichedUser?.roles?.includes('admin') || false;
  const isAdminAuthenticated = enrichedUser?.roles?.includes('admin');

  // Store the redirect path for after login
  const storeRedirectPath = useCallback((path: string) => {
    if (path && !['/login', '/register', '/'].includes(path)) {
      localStorage.setItem('redirectAfterLogin', path);
      setRedirectPath(path);
      console.log('[storeRedirectPath] Stored redirect path:', path);
    } else {
      console.log('[storeRedirectPath] Skipped storing path:', path);
    }
  }, []);

  // Handle redirect after login - memoized to avoid dependency loops
  const handleRedirectAfterLogin = useCallback(() => {
    // Pull from both state and localStorage to ensure we don't lose the path
    let redirectTo = redirectPath;
    if (!redirectTo) {
      redirectTo = localStorage.getItem('redirectAfterLogin') || '/dashboard';
      console.log('[handleRedirectAfterLogin] Fallback redirectTo from localStorage:', redirectTo);
    } else {
      console.log('[handleRedirectAfterLogin] RedirectTo from state:', redirectTo);
    }

    // Security check - don't allow non-admins to access admin routes
    if (enrichedUser && !enrichedUser.roles?.includes('admin') && redirectTo.startsWith('/admin')) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access the admin area.',
        variant: 'destructive',
      });
      redirectTo = '/dashboard';
    }

    // Clean up stored redirect path
    localStorage.removeItem('redirectAfterLogin');
    setRedirectPath(null);
    console.log('[handleRedirectAfterLogin] Redirecting to:', redirectTo);
    navigate(redirectTo, { replace: true });
  }, [navigate, redirectPath, toast]);

  // Initialize authentication state
  useEffect(() => {
    let isMounted = true;
    console.log('[useAuth] Setting up auth state listener');

    // Set up auth state listener
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;

      console.log('[useAuth] Auth state changed, new session:', !!newSession);
      setSession(newSession);
      
      // Important: Don't trigger other side effects here to prevent deadlocks
      // Let the separate useEffect handle redirects based on session change
    });

    // Get initial session
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

  // Handle redirects in a separate effect with proper dependencies
  useEffect(() => {
    // Only redirect if authenticated, data loaded, and have a redirect path
    if (isAuthenticated && !loading && !profileLoading && redirectPath) {
      console.log('[useAuth] Ready to redirect - isAuthenticated:', isAuthenticated, 'loading:', loading, 'profileLoading:', profileLoading);
      
      // Use setTimeout to prevent potential race conditions with auth state changes
      setTimeout(() => {
        if (isAuthenticated) {
          handleRedirectAfterLogin();
        }
      }, 0);
    }
  }, [isAuthenticated, loading, profileLoading, redirectPath, handleRedirectAfterLogin]);

  // Login function
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

  // Social sign-in function
  const socialSignIn = useCallback(async (provider: 'google' | 'github' | 'twitter') => {
    try {
      setLoading(true);

      // Get the redirect path from localStorage
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

  // Registration function
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
      console.error('[register] Registration error:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  // Logout function
  const logout = useCallback(async () => {
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

  // Return a memoized auth context value to prevent unnecessary re-renders
  const authValue = useMemo(() => ({
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
  }), [
    session,
    enrichedUser, 
    loading, 
    profileLoading,
    error,
    login,
    register,
    logout,
    socialSignIn,
    isAuthenticated,
    isAdmin, 
    isAdminAuthenticated,
    storeRedirectPath,
    handleRedirectAfterLogin
  ]);

  return authValue;
};

export type AuthContextType = ReturnType<typeof useAuthProvider>;

// Export the useAuthProvider function as useAuth
export const useAuth = useAuthProvider;
