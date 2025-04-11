import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Loader2, Shield } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { FaGoogle } from 'react-icons/fa';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const { login, googleSignIn, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract redirect URL and tab from query parameters
  const query = new URLSearchParams(location.search);
  const redirectParam = query.get('redirect');
  const defaultTab = query.get('tab') || 'user';
  
  // Get the from location - prioritize different sources
  // 1. From location state (highest priority)
  // 2. From URL parameter
  // 3. From localStorage (fallback)
  const fromState = location.state?.from?.pathname;
  const from = fromState || redirectParam || localStorage.getItem('redirectAfterLogin');
  
  // Store the redirect URL in localStorage when the component mounts
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

  // States for regular login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // States for admin login
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  
  // Redirect authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      const redirectPath = from || '/dashboard';
      console.log('Login page: User authenticated, redirecting to:', redirectPath);
      navigate(redirectPath, { replace: true });
      if (!redirectPath.startsWith('/admin')) {
        // Only clear localStorage if not redirecting to admin route
        // Admin routes should keep their redirects in sessionStorage
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
      // Redirect handled by useEffect
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      // The redirect URL is already stored in localStorage by the useEffect above
      await googleSignIn();
      // OAuth redirect will happen automatically
    } catch (error: any) {
      console.error('Google sign-in failed:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    
    try {
      // For demo purposes, hardcoded admin credentials
      if (adminUsername === 'admin' && adminPassword === 'admin123') {
        // Store admin authentication in session storage
        sessionStorage.setItem('isAdminAuthenticated', 'true');
        
        toast({
          title: 'Success',
          description: 'Logged in as administrator',
        });
        
        // Redirect to admin dashboard or previous admin page
        const adminRedirect = fromState?.startsWith('/admin') 
          ? fromState 
          : localStorage.getItem('redirectAfterLogin')?.startsWith('/admin')
            ? localStorage.getItem('redirectAfterLogin')
            : '/admin';
        
        console.log('Admin login: Redirecting to:', adminRedirect);
        navigate(adminRedirect);
      } else {
        toast({
          title: 'Error',
          description: 'Invalid admin credentials',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Admin login error:', error);
      toast({
        title: 'Error',
        description: 'An error occurred during login',
        variant: 'destructive',
      });
    } finally {
      setAdminLoading(false);
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
        
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="user">User Login</TabsTrigger>
            <TabsTrigger value="admin">Admin Access</TabsTrigger>
          </TabsList>
          
          <TabsContent value="user">
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
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
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
          </TabsContent>
          
          <TabsContent value="admin">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-primary" /> 
                  Administrator Access
                </CardTitle>
                <CardDescription>
                  Restricted area. Authorized personnel only.
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminUsername">Username</Label>
                    <Input
                      id="adminUsername"
                      placeholder="admin"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Password</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={adminLoading}>
                    {adminLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Authenticating...
                      </>
                    ) : (
                      'Administrator Login'
                    )}
                  </Button>
                </form>
              </CardContent>
              
              <CardFooter className="text-center text-xs text-muted-foreground">
                <p className="w-full">
                  For demo: Username: admin, Password: admin123
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Login;
