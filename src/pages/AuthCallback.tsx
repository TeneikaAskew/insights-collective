import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { handleRedirectAfterLogin } = useAuth();

  useEffect(() => {
    // Wait a brief moment to let Supabase session settle
    const timeout = setTimeout(() => {
      handleRedirectAfterLogin();
    }, 300); // Give Supabase a second to update session

    return () => clearTimeout(timeout);
  }, [handleRedirectAfterLogin]);

  return (
    <div className="flex justify-center items-center h-screen">
      <p className="text-muted-foreground">Completing login, please wait...</p>
    </div>
  );
};

export default AuthCallback;
