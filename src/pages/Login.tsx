
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Loader2, Eye, EyeOff } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { FaGoogle, FaGithub, FaTwitter } from 'react-icons/fa';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const { login, googleSignIn, githubSignIn, twitterSignIn, isAuthenticated, storeRedirectPath } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract redirect path from various sources
  const query = new URLSearchParams(location.search);
  const redirectParam = query.get('redirect');
  const fromState = location.state?.from?.pathname;
  const storedPath = localStorage.getItem('redirectAfterLogin');
  
  
  // Determine the redirect destination based on priority
  // const redirectDestination = redirectParam || fromState || storedPath || '/dashboard';
  const redirectDestination = redirectParam;// || fromState ; //|| '/dashboard'
  const encodedRedirect = encodeURIComponent(redirectDestination);

  
  // Store redirect path on component mount
  useEffect(() => {
    console.log(location, 'Login page: Checking redirect paths. Options:', {
      fromState,
      redirectParam,
      storedPath,
      currentPath: location.pathname
    });
    
    if (redirectDestination && redirectDestination !== '/login' && redirectDestination !== '/register') {
      // Use context method to store redirect path
      storeRedirectPath(redirectDestination);
      console.log('Login page: stored redirect path:', redirectDestination);
    }
  }, [redirectDestination, storeRedirectPath, fromState, redirectParam, location.pathname]);

  // Redirect authenticated users
  // useEffect(() => {
  //   if (isAuthenticated) {
  //     console.log('Login page: User authenticated, redirecting to:', redirectDestination);
  //     navigate(redirectDestination, { replace: true });
  //     // Only clear localStorage path if not an admin route (preserves admin redirects)
  //     if (redirectDestination && !redirectDestination.startsWith('/admin')) {
  //       localStorage.removeItem('redirectAfterLogin');
  //     }
  //   }
  // }, [isAuthenticated, navigate, redirectDestination]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    try {
      setLoading(true);
      await login(email, password);
      // Redirect handled by useEffect when isAuthenticated changes
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSocialSignIn = async (provider: 'google' | 'github' | 'twitter') => {
    try {
      setError(null);
      setSocialLoading(provider);
      
      // Before social login, ensure the redirect path is saved
      if (redirectDestination && redirectDestination !== '/login' && redirectDestination !== '/register') {
        storeRedirectPath(redirectDestination);
      }
      
      switch (provider) {
        case 'google':
          await googleSignIn();
          break;
        case 'github':
          await githubSignIn();
          break;
        case 'twitter':
          await twitterSignIn();
          break;
      }
      // Redirect for social logins is handled by the OAuth provider callback
    } catch (error: any) {
      console.error(`${provider} sign-in failed:`, error);
      
      if (error.message?.includes('provider is not enabled')) {
        setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in is not enabled. Please contact your administrator.`);
        toast({
          title: 'Authentication Error',
          description: `${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in is not enabled in the Supabase dashboard.`,
          variant: 'destructive'
        });
      } else if (error.message?.includes('redirect')) {
        setError(`Unable to complete ${provider} sign-in. Please check your network connection.`);
      } else {
        setError(error.message || `Failed to sign in with ${provider}`);
      }
    } finally {
      setSocialLoading(null);
    }
  };
  
  if (isAuthenticated) {
    return <div className="flex justify-center items-center h-screen">Redirecting...</div>;
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center text-2xl font-bold text-primary">
            <GraduationCap className="h-8 w-8 mr-2" />
            Insights Collective
          </Link>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your Insights Collective account
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="flex flex-col gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full flex items-center justify-center"
                onClick={() => handleSocialSignIn('google')}
                disabled={!!socialLoading}
              >
                {socialLoading === 'google' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FaGoogle className="mr-2 h-4 w-4" />
                )}
                Sign in with Google
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                className="w-full flex items-center justify-center"
                onClick={() => handleSocialSignIn('github')}
                disabled={!!socialLoading}
              >
                {socialLoading === 'github' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FaGithub className="mr-2 h-4 w-4" />
                )}
                Sign in with GitHub
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                className="w-full flex items-center justify-center"
                onClick={() => handleSocialSignIn('twitter')}
                disabled={!!socialLoading}
              >
                {socialLoading === 'twitter' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FaTwitter className="mr-2 h-4 w-4" />
                )}
                Sign in with Twitter
              </Button>
            </div>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            
            <form onSubmit={handleUserLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@ic.tech"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/reset-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
              
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary hover:underline">
                  Create account
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
