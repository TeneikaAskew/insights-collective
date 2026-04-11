
import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useNavigate, useLocation, NavigateFunction, Location } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';
import { useToast } from './use-toast';
import { useAuthRedirect } from './useAuthRedirect';
import { createLogger } from '@/utils/logger';

const logger = createLogger('useAuth');

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
    logger.warn('Navigation hooks used outside Router context');
  }
  
  return { navigate, location };
};

export const useAuthProvider = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { navigate, location } = useSafeNavigation();
  const { toast } = useToast();
  const redirect = useAuthRedirect();

  const { enrichedUser, loading: profileLoading } = useUserProfile(session?.user ?? null);

  const isAuthenticated = !!enrichedUser;
  
  // Add explicit isAdmin property
  const isAdmin = enrichedUser?.roles?.includes('admin') || false;
  const isAdminAuthenticated = enrichedUser?.roles?.includes('admin');

  logger.log('[useAuth] Current enrichedUser:', enrichedUser);
  logger.log('[useAuth] enrichedUser roles:', enrichedUser?.roles);
  logger.log('[useAuth] isAdmin result:', isAdmin);
  logger.log('[useAuth] isAdminAuthenticated result:', isAdminAuthenticated);

  // Use redirect hook instead of local state
  const storeRedirectPath = redirect.storeRedirectPath;
  const handleRedirectAfterLogin = useCallback(() => {
    if (isAuthenticated && enrichedUser) {
      redirect.executeRedirect(enrichedUser);
    }
  }, [isAuthenticated, enrichedUser, redirect]);

  useEffect(() => {
    let isMounted = true;

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;

      logger.log('[useAuth] Auth state changed, new session:', !!newSession);
      setSession(newSession);
    });

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          logger.error('[useAuth] Error getting session:', error);
          setSession(null);
        } else if (data.session) {
          logger.log('[useAuth] Session found during initialization');
          setSession(data.session);
        } else {
          logger.log('[useAuth] No session found during initialization');
          setSession(null);
        }
      } catch (err) {
        logger.error('[useAuth] Unexpected error during getSession:', err);
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

  // Remove automatic redirect - let AuthProvider handle it manually

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
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const socialSignIn = useCallback(async (provider: 'google' | 'github' | 'twitter') => {
    try {
      setLoading(true);

      // Get the redirect path from localStorage - this should be set before calling socialSignIn
      const redirectPath = localStorage.getItem('redirectAfterLogin') || '/resources';
      
      logger.log(`[socialSignIn] Signing in with ${provider}. Redirect path: ${redirectPath}`);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`
        }
      });

      if (error) throw error;
    } catch (error: any) {
      logger.error(`[socialSignIn] ${provider} sign-in error:`, error);
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
      logger.error('Navigation not available, cannot complete registration flow');
      throw new Error('Navigation not available');
    }
    
    try {
      setLoading(true);
      setError(null);

      logger.log('[register] Starting registration process for:', { name, email });

      // Enhanced validation before sending to Supabase
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      if (!name.trim()) {
        throw new Error('Please enter your full name');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: name.split(' ')[0],
            last_name: name.split(' ').slice(1).join(' ') || '',
            full_name: name,
          },
        },
      });

      if (error) {
        logger.error('[register] Supabase error:', error);
        
        // Handle specific Supabase errors with clearer messages
        if (error.message.includes('email_address_invalid') || 
            (error.message.includes('Email address') && error.message.includes('is invalid'))) {
          throw new Error('This email address is not valid. Please check the format and try again.');
        } else if (error.message.includes('signup_disabled')) {
          throw new Error('User registration is currently disabled. Please contact support.');
        } else if (error.message.includes('User already registered') || 
                   error.message.includes('already exists')) {
          throw new Error('An account with this email already exists. Please try signing in instead.');
        } else if (error.message.includes('password')) {
          throw new Error('Password does not meet requirements. Please try a different password.');
        } else {
          // Pass through the original error message for any other errors
          throw new Error(error.message || 'Registration failed. Please try again.');
        }
      }

      logger.log('[register] Registration successful:', { userId: data.user?.id, needsConfirmation: !data.session });

      // Check if user needs email confirmation
      if (data.user && !data.session) {
        logger.log('[register] Email confirmation required');
        // Don't navigate immediately, let the component handle showing the success message
        return { success: true, needsEmailVerification: true };
      } else if (data.session) {
        logger.log('[register] User registered and signed in automatically');
        // Navigate to login page after a brief delay to show success message
        setTimeout(() => {
          navigate('/login');
        }, 2000);
        return { success: true, needsEmailVerification: false };
      }

      return { success: true, needsEmailVerification: true };
    } catch (error: any) {
      logger.error('[register] Registration error:', error);
      setError(error.message);
      throw error; // Re-throw so the component can handle it
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  const logout = useCallback(async () => {
    if (!navigate) {
      logger.error('Navigation not available, cannot complete logout flow');
      return;
    }
    
    try {
      await supabase.auth.signOut();
      setSession(null);
      navigate('/');
    } catch (error: any) {
      logger.error('[logout] Error during sign out:', error);
      toast({ 
        title: 'Error signing out',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [navigate, toast]);

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
