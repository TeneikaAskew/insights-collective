
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Loader2, Eye, EyeOff } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { FaGoogle } from 'react-icons/fa';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const { login, googleSignIn, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const query = new URLSearchParams(location.search);
  const redirectParam = query.get('redirect');
  
  const fromState = location.state?.from?.pathname;
  const from = fromState || redirectParam || localStorage.getItem('redirectAfterLogin');
  
  useEffect(() => {
    console.log('Login page: Checking redirect paths. Options:', {
      fromState,
      redirectParam,
      localStoragePath: localStorage.getItem('redirectAfterLogin'),
      currentPath: location.pathname
    });
    
    if (from && from !== '/login' && from !== '/register') {
      localStorage.setItem('redirectAfterLogin', from);
      console.log('Login page: stored redirect path:', from);
    }
  }, [from, fromState, redirectParam, location.pathname]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (isAuthenticated) {
      const redirectPath = from || '/dashboard';
      console.log('Login page: User authenticated, redirecting to:', redirectPath);
      navigate(redirectPath, { replace: true });
      if (!redirectPath.startsWith('/admin')) {
        localStorage.removeItem('redirectAfterLogin');
      }
    }
  }, [isAuthenticated, navigate, from]);
  
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
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await googleSignIn();
    } catch (error: any) {
      console.error('Google sign-in failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
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
            <Button 
              type="button" 
              variant="outline" 
              className="w-full flex items-center justify-center mb-4"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <FaGoogle className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button>
            
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
