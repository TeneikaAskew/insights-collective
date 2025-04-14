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
  
  // Simplified helper function to handle post-login redirects
  const handleRedirectAfterLogin = useCallback(() => {
    // Prevent multiple redirects running at once
    if (redirectInProgressRef.current) {
      return;
    }
    
    redirectInProgressRef.current = true;
    
    try {
      // Get redirect path with clear priority order
      const redirectParam = new URLSearchParams(location.search).get('redirect');
      const fromPath = location.state?.from?.pathname;
      const storedRedirect = localStorage.getItem('redirectAfterLogin');
      
      // Choose redirect path based on priority
      let redirectTo = '/dashboard'; // Default fallback
      
      if (redirectParam && redirectParam !== '/login' && redirectParam !== '/register') {
        redirectTo = redirectParam;
        localStorage.removeItem('redirectAfterLogin'); // Clean up stored path
        if (process.env.NODE_ENV === "development") {
          console.log('Redirecting to URL parameter path:', redirectParam);
        }
      } 
      else if (fromPath && fromPath !== '/login' && fromPath !== '/register') {
        redirectTo = fromPath;
        localStorage.removeItem('redirectAfterLogin'); // Clean up stored path
        if (process.env.NODE_ENV === "development") {
          console.log('Redirecting to location state path:', fromPath);
        }
      } 
      else if (storedRedirect && storedRedirect !== '/login' && storedRedirect !== '/register') {
        redirectTo = storedRedirect;
        localStorage.removeItem('redirectAfterLogin'); // Clean up stored path
        if (process.env.NODE_ENV === "development") {
          console.log('Redirecting to localStorage path:', storedRedirect);
        }
      }
      else if (process.env.NODE_ENV === "development") {
        console.log('No specific redirect path found, using default:', redirectTo);
      }
      
      // Handle redirection based on roles and path
      if (!enrichedUser?.roles?.includes('admin') && redirectTo.startsWith('/admin')) {
        // Non-admin trying to access admin route
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to access the admin area.',
          variant: 'destructive'
        });
        redirectTo = '/dashboard';
      }
      
      // Execute the redirect with replace to avoid back-button issues
      if (process.env.NODE_ENV === "development") {
        console.log('Final redirect destination:', redirectTo);
      }
      
      navigate(redirectTo, { replace: true });
    } finally {
      // Reset the redirect flag after a delay
      setTimeout(() => {
        redirectInProgressRef.current = false;
      }, 100);
    }
  }, [navigate, location, enrichedUser, toast]);
  
  // Update session and user on auth state change
  useEffect(() => {
    // Prevent multiple initializations
    if (authInitializedRef.current) return;
    authInitializedRef.current = true;
    
    let isActive = true;
    
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        // Set up auth state listener
        const { data: authListener } = supabase.auth.onAuthStateChange(
          (event, newSession) => {
            if (!isActive) return;
            
            if (process.env.NODE_ENV === "development") {
              console.log('Auth state changed:', event, !!newSession);
            }
            
            if (newSession) {
              setSession(newSession);
              
              // Handle successful sign-in events with explicit redirection
              if (event === 'SIGNED_IN') {
                toast({
                  title: 'Success',
                  description: 'Logged in successfully',
                });
                
                // Use setTimeout to ensure state is updated before redirect
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
        
        // Check for existing session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session retrieval error:', sessionError);
          if (isActive) await forceSignOut();
        } else if (sessionData.session && isActive) {
          if (process.env.NODE_ENV === "development") {
            console.log('Initial session check:', !!sessionData.session);
          }
          setSession(sessionData.session);
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
  }, [handleRedirectAfterLogin]);
  
  // Force sign out function
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
