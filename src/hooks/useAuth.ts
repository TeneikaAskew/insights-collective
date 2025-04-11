
import { useState, useEffect, useCallback } from 'react';
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
  
  // Get enriched user data
  const { enrichedUser, loading: profileLoading } = useUserProfile(session?.user ?? null);
  
  // Helper function to handle post-login redirects
  const handleRedirectAfterLogin = useCallback(() => {
    // Priority 1: Check URL parameters for redirect info
    const urlParams = new URLSearchParams(location.search);
    const redirectParam = urlParams.get('redirect');
    
    // Priority 2: Check location state for redirect info
    const locationState = location.state as { from?: { pathname: string } } | null;
    const fromPath = locationState?.from?.pathname;
    
    // Priority 3: Check localStorage for saved redirect path
    const storedRedirect = localStorage.getItem('redirectAfterLogin');
    
    console.log('Redirect options:', { redirectParam, fromPath, storedRedirect });
    
    // Choose redirect path based on priority
    let redirectTo = '/dashboard'; // Default fallback
    
    if (redirectParam) {
      redirectTo = redirectParam;
      console.log('Using redirect from URL parameter:', redirectParam);
    } else if (fromPath && fromPath !== '/login' && fromPath !== '/register') {
      redirectTo = fromPath;
      console.log('Using redirect from location state:', fromPath);
    } else if (storedRedirect && storedRedirect !== '/login' && storedRedirect !== '/register') {
      redirectTo = storedRedirect;
      console.log('Using redirect from localStorage:', storedRedirect);
      // Clear the stored redirect, but only if it's not an admin route
      if (!redirectTo.startsWith('/admin')) {
        localStorage.removeItem('redirectAfterLogin');
      }
    }
    
    // Special case for admin routes
    const isAdmin = sessionStorage.getItem('isAdminAuthenticated') === 'true';
    if (isAdmin && redirectTo.startsWith('/admin')) {
      console.log('Redirecting admin to:', redirectTo);
    } else if (isAdmin && !redirectTo.startsWith('/admin')) {
      // If admin is logged in but redirect is not to admin route, still honor the redirect
      console.log('Admin redirecting to non-admin route:', redirectTo);
    }
    
    console.log('Final redirect destination:', redirectTo);
    navigate(redirectTo, { replace: true });
  }, [navigate, location]);
  
  // Store redirect path function
  const storeRedirectPath = useCallback((path: string) => {
    if (path && path !== '/login' && path !== '/register') {
      localStorage.setItem('redirectAfterLogin', path);
      console.log('Stored redirect path:', path);
    }
  }, []);
  
  // Update session and user on auth state change
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, !!session);
        
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          setSession(session);
          
          // Use setTimeout to avoid auth state deadlocks
          setTimeout(() => {
            handleRedirectAfterLogin();
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          // Don't clear localStorage here to avoid issues with admin redirects
          console.log('User signed out');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', !!session);
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleRedirectAfterLogin]);
  
  const login = useCallback(async (email: string, password: string, redirectTo?: string) => {
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
      
      // Don't navigate here - let the auth state change handler do it
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

  const googleSignIn = useCallback(async (redirectTo?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Store redirect URL for after auth if provided and not already stored
      if (redirectTo && !localStorage.getItem('redirectAfterLogin')) {
        localStorage.setItem('redirectAfterLogin', redirectTo);
      } else if (location.pathname !== '/login' && !localStorage.getItem('redirectAfterLogin')) {
        localStorage.setItem('redirectAfterLogin', location.pathname);
      }
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
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
  }, [toast, location]);

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
  const isAdminAuthenticated = sessionStorage.getItem('isAdminAuthenticated') === 'true';
  
  return {
    user: enrichedUser,
    session,
    loading: loading || profileLoading,
    error,
    login,
    register,
    googleSignIn,
    logout,
    adminLogout,
    isAdminAuthenticated,
    isAuthenticated: !!enrichedUser,
    storeRedirectPath
  };
};

export type AuthContextType = ReturnType<typeof useAuthProvider>;
