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
  
  // Update session and user on auth state change
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          setSession(session);
          
          // Check for redirect after sign-in
          const redirectPath = localStorage.getItem('redirectAfterLogin');
          if (redirectPath) {
            setTimeout(() => {
              navigate(redirectPath);
              localStorage.removeItem('redirectAfterLogin');
            }, 0);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);
  
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
      
      // Redirect to the specified path or dashboard
      navigate(redirectTo || '/dashboard');
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

  const googleSignIn = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For Google OAuth, we'll store the redirect URL and use it when the auth state changes
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
  }, [toast]);

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
      await supabase.auth.signOut();
      toast({
        title: 'Success',
        description: 'Logged out successfully',
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [navigate, toast]);
  
  return {
    user: enrichedUser,
    session,
    loading: loading || profileLoading,
    error,
    login,
    register,
    googleSignIn,
    logout,
    isAuthenticated: !!enrichedUser
  };
};

export type AuthContextType = ReturnType<typeof useAuthProvider>;
