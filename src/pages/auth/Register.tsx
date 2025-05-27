
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Loader2, Eye, EyeOff } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { FaGoogle, FaGithub, FaTwitter } from 'react-icons/fa';
import { useToast } from '@/hooks/use-toast';

const Register = () => {
  const {
    register,
    googleSignIn,
    githubSignIn,
    twitterSignIn,
    isAuthenticated,
    handleRedirectAfterLogin
  } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const query = new URLSearchParams(location.search);
  const redirectParam = query.get('redirect');
  
  useEffect(() => {
    console.log('[Register] Mounted');
    console.log('[Register] redirectParam:', redirectParam);

    // Store the redirect path from query params if it exists
    if (redirectParam) {
      localStorage.setItem('redirectAfterLogin', redirectParam);
    }
  }, [redirectParam]);
  
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[Register] isAuthenticated true. Calling handleRedirectAfterLogin...');
      handleRedirectAfterLogin();
    } else {
      console.log('[Register] Not authenticated');
    }
  }, [isAuthenticated, handleRedirectAfterLogin]);
  
  const handleUserRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    console.log('[handleUserRegister] Registering with email:', email);
    try {
      setLoading(true);
      await register(email, password, `${firstName} ${lastName}`);
    } catch (error: any) {
      console.error('[handleUserRegister] Registration error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSocialSignIn = async (provider: 'google' | 'github' | 'twitter') => {
    console.log(`[handleSocialSignIn] Initiating ${provider} registration`);
    try {
      setError(null);
      setSocialLoading(provider);

      // Store the redirect path BEFORE initiating social sign in
      const redirectParam = query.get('redirect');
      const redirectPath = redirectParam || '/resources';
      localStorage.setItem('redirectAfterLogin', redirectPath);
      console.log(`[handleSocialSignIn] Stored redirect path: ${redirectPath}`);
      
      const signInMethod = {
        'google': googleSignIn,
        'github': githubSignIn,
        'twitter': twitterSignIn
      }[provider];
      
      if (signInMethod) {
        await signInMethod();
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error: any) {
      console.error(`[${provider}] Social sign-in failed:`, error);
      toast({
        title: 'Authentication Error',
        description: error.message || `Failed to sign up with ${provider}`,
        variant: 'destructive'
      });
      setError(error.message || `Failed to sign up with ${provider}`);
    } finally {
      setSocialLoading(null);
    }
  };
  
  if (isAuthenticated) {
    console.log('[Register] Already authenticated - showing "Redirecting..." screen');
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center text-2xl font-bold text-primary">
            <GraduationCap className="h-8 w-8 mr-2" />
            Insights Collective
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create an account</CardTitle>
            <CardDescription>
              Join Insights Collective and start your learning journey
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
                Sign up with Google
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

            <form onSubmit={handleUserRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input 
                    id="firstName" 
                    type="text" 
                    placeholder="John" 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input 
                    id="lastName" 
                    type="text" 
                    placeholder="Doe" 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              
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
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />
                  <button 
                    type="button" 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" 
                    onClick={() => setShowPassword(prev => !prev)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input 
                    id="confirmPassword" 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    required 
                  />
                  <button 
                    type="button" 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" 
                    onClick={() => setShowConfirmPassword(prev => !prev)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
