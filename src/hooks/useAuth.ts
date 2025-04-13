
import { useState, useEffect, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { useToast } from './use-toast';
import { UserWithProfile } from '@/types/supabase';

/**
 * Custom hook for authentication functionality
 */
export const useAuthProvider = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const authInitializedRef = useRef(false);
  const redirectInProgressRef = useRef(false);
  
  // Get enriched user data
  const { enrichedUser, loading: profileLoading } = useUserProfile(session?.user ?? null);
  
  // Helper function to store redirect path with debugging
  const storeRedirectPath = useCallback((path: string) => {
    if (path && path !== '/login' && path !== '/register' && path !== '/') {
      localStorage.setItem('redirectAfterLogin', path);
      if (process.env.NODE_ENV === "development") {
        console.log('Stored redirect path in useAuth:', path);
      }
    }
  }, []);
  
  // Helper function to handle post-login redirects
  const handleRedirectAfterLogin = useCallback(() => {
    // Prevent multiple redirects running at once
    if (redirectInProgressRef.current) {
      return;
    }
    
    redirectInProgressRef.current = true;
    
    try {
      // Priority 1: Check URL parameters for redirect info
      const urlParams = new URLSearchParams(location.search);
      const redirectParam = urlParams.get('redirect');
      
      // Priority 2: Check location state for redirect info
      const locationState = location.state as { from?: { pathname: string } } | null;
      const fromPath = locationState?.from?.pathname;
      
      // Priority 3: Check localStorage for saved redirect path
      const storedRedirect = localStorage.getItem('redirectAfterLogin');
      
      if (process.env.NODE_ENV === "development") {
        console.log('Redirect options:', { redirectParam, fromPath, storedRedirect });
      }
      
      // Choose redirect path based on priority
      let redirectTo = '/dashboard'; // Default fallback
      
      if (redirectParam && redirectParam !== '/login' && redirectParam !== '/register') {
        redirectTo = redirectParam;
        if (process.env.NODE_ENV === "development") {
          console.log('Using redirect from URL parameter:', redirectParam);
        }
      } else if (fromPath && fromPath !== '/login' && fromPath !== '/register') {
        redirectTo = fromPath;
        if (process.env.NODE_ENV === "development") {
          console.log('Using redirect from location state:', fromPath);
        }
      } else if (storedRedirect && storedRedirect !== '/login' && storedRedirect !== '/register') {
        redirectTo = storedRedirect;
        if (process.env.NODE_ENV === "development") {
          console.log('Using redirect from localStorage:', storedRedirect);
        }
      }
      
      // Handle redirection based on roles and path
      if (enrichedUser?.roles?.includes('admin') && redirectTo.startsWith('/admin')) {
        if (process.env.NODE_ENV === "development") {
          console.log('Redirecting admin to:', redirectTo);
        }
        navigate(redirectTo, { replace: true });
      } else if (enrichedUser?.roles?.includes('admin') && !redirectTo.startsWith('/admin')) {
        // If admin is logged in but redirect is not to admin route, still honor the redirect
        if (process.env.NODE_ENV === "development") {
          console.log('Admin redirecting to non-admin route:', redirectTo);
        }
        navigate(redirectTo, { replace: true });
      } else if (!enrichedUser?.roles?.includes('admin') && redirectTo.startsWith('/admin')) {
        // If non-admin tries to access admin route, redirect to dashboard
        if (process.env.NODE_ENV === "development") {
          console.log('Non-admin attempted to access admin route, redirecting to dashboard');
        }
        redirectTo = '/dashboard';
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to access the admin area.',
          variant: 'destructive'
        });
        navigate(redirectTo, { replace: true });
      } else {
        // Standard user redirect
        if (process.env.NODE_ENV === "development") {
          console.log('Standard redirect to:', redirectTo);
        }
        navigate(redirectTo, { replace: true });
      }
      
      // Clear the stored redirect, but only if it's not an admin route
      if (!redirectTo.startsWith('/admin')) {
        localStorage.removeItem('redirectAfterLogin');
      }
    } finally {
      // Reset the redirect flag after a delay to prevent redirect loops
      setTimeout(() => {
        redirectInProgressRef.current = false;
      }, 100);
    }
  }, [navigate, location, enrichedUser, toast]);
  
  // Force sign out function for handling invalid sessions
  const forceSignOut = useCallback(async () => {
    try {
      if (process.env.NODE_ENV === "development") {
        console.log('Force signing out due to invalid session');
      }
      await supabase.auth.signOut();
      setSession(null);
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Force sign out error:', error);
    }
  }, [navigate]);

  // Update session and user on auth state change
  useEffect(() => {
    // Prevent multiple initializations
    if (authInitializedRef.current) return;
    authInitializedRef.current = true;
    
    let isActive = true;
    
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        // FIRST: Set up auth state listener (with proper cleanup)
        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            if (!isActive) return;
            
            if (process.env.NODE_ENV === "development") {
              console.log('Auth state changed:', event, !!newSession);
            }
            
            if (newSession) {
              setSession(newSession);
              
              // Handle sign in events with setTimeout to avoid deadlocks
              if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                setTimeout(() => {
                  if (isActive && !redirectInProgressRef.current) {
                    handleRedirectAfterLogin();
                  }
                }, 100);
              }
            } else if (event === 'SIGNED_OUT') {
              setSession(null);
              if (process.env.NODE_ENV === "development") {
                console.log('User signed out');
              }
            }
          }
        );
        
        // SECOND: Check for existing session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session retrieval error:', sessionError);
          if (isActive) await forceSignOut();
        } else if (sessionData.session && isActive) {
          if (process.env.NODE_ENV === "development") {
            console.log('Initial session check:', !!sessionData.session);
          }
          setSession(sessionData.session);
          
          // Don't automatically redirect on initial load
          // This allows pages to control redirection themselves
        }
        
        if (isActive) setLoading(false);
        
        // Return cleanup function
        return () => {
          if (authListener?.subscription) {
            authListener.subscription.unsubscribe();
          }
        };
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (isActive) {
          setLoading(false);
          await forceSignOut();
        }
        return undefined;
      }
    };

    // Start the auth initialization and store the cleanup function
    const cleanup = initializeAuth();
    
    // Return the cleanup function to useEffect
    return () => {
      isActive = false;
      // Execute the cleanup function if it exists
      if (cleanup) {
        cleanup.then(cleanupFn => {
          if (cleanupFn) cleanupFn();
        });
      }
    };
  }, [handleRedirectAfterLogin, forceSignOut]);
  
  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Logged in successfully',
      });
      
      // Redirect handled by auth state change handler
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
      setError(null);
      
      // Use the redirectTo option to handle post-auth redirects reliably
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        }
      });
      
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

  const googleSignIn = useCallback(() => {
    return socialSignIn('google');
  }, [socialSignIn]);

  const githubSignIn = useCallback(() => {
    return socialSignIn('github');
  }, [socialSignIn]);

  const twitterSignIn = useCallback(() => {
    return socialSignIn('twitter');
  }, [socialSignIn]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: name.split(' ')[0],
            last_name: name.split(' ').slice(1).join(' ')
          }
        }
      });
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Account created successfully. Please check your email for confirmation.',
      });
      
      navigate('/login');
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
  }, [navigate, toast]);

  const logout = useCallback(async () => {
    try {
      console.log('Logging out...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      // Clear admin authentication in session storage
      sessionStorage.removeItem('isAdminAuthenticated');
      
      // Clear redirect after login
      localStorage.removeItem('redirectAfterLogin');
      
      // Clear session state
      setSession(null);
      
      toast({
        title: 'Success',
        description: 'Logged out successfully',
      });
      
      // Navigate to homepage after logout
      navigate('/');
    } catch (error: any) {
      console.error('Logout error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [navigate, toast]);
  
  // Admin logout function
  const adminLogout = useCallback(() => {
    sessionStorage.removeItem('isAdminAuthenticated');
    toast({
      title: 'Success',
      description: 'Admin logged out successfully',
    });
    navigate('/');
  }, [navigate, toast]);
  
  // Check admin authentication
  const isAdminAuthenticated = enrichedUser?.roles?.includes('admin');
  
  return {
    user: enrichedUser,
    session,
    loading: loading || profileLoading,
    error,
    login,
    register,
    googleSignIn,
    githubSignIn,
    twitterSignIn,
    logout,
    isAdminAuthenticated,
    isAuthenticated: !!enrichedUser,
    storeRedirectPath,
    handleRedirectAfterLogin
  };
};

export type AuthContextType = ReturnType<typeof useAuthProvider>;
