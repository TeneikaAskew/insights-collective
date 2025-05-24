
import { useState, useEffect } from 'react';
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  
  const {
    register,
    googleSignIn,
    githubSignIn,
    twitterSignIn,
    loading,
    error,
    storeRedirectPath
  } = useAuth();
  
  const location = useLocation();
  const { toast } = useToast();

  // Store the current path or referrer for redirect after registration
  const storeCurrentPath = () => {
    const from = location.state?.from?.pathname;
    const query = new URLSearchParams(location.search);
    const redirectParam = query.get('redirect');
    const redirectPath = redirectParam || from;
    
    if (redirectPath && redirectPath !== '/login' && redirectPath !== '/register') {
      storeRedirectPath(redirectPath);
      console.log('Register page: Stored redirect path:', redirectPath);
    }
  };

  useEffect(() => {
    storeCurrentPath();
  }, [location]);

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation function
  const validatePassword = (password: string): boolean => {
    return password.length >= 6; // Minimum 6 characters
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setPasswordError('');
    setEmailError('');
    
    // Validate email
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    // Validate password
    if (!validatePassword(password)) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }
    
    // Check password confirmation
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    // Check if name is provided
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your full name',
        variant: 'destructive',
      });
      return;
    }

    setFormSubmitting(true);
    
    try {
      storeCurrentPath();
      await register(name.trim(), email.trim(), password);
      
      // Show success message
      toast({
        title: 'Registration Successful',
        description: 'Please check your email to verify your account before signing in.',
      });
      
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: 'Registration Failed',
        description: error.message || 'An error occurred during registration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSocialSignIn = async (provider: 'google' | 'github' | 'twitter') => {
    try {
      setSocialLoading(provider);

      // Store path for redirect before social sign-in
      const from = location.state?.from?.pathname;
      const query = new URLSearchParams(location.search);
      const redirectParam = query.get('redirect');
      const redirectPath = redirectParam || from || '/resources';
      
      localStorage.setItem('redirectAfterLogin', redirectPath);
      console.log('[Register] Stored redirect path before social sign-in:', redirectPath);
      
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
        description: error.message || `Failed to sign in with ${provider}`,
        variant: 'destructive'
      });
    } finally {
      setSocialLoading(null);
    }
  };

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
              Get started with Insights Collective today
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="flex flex-col gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full flex items-center justify-center" 
                onClick={() => handleSocialSignIn('google')} 
                disabled={loading || formSubmitting || !!socialLoading}
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
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  placeholder="John Doe" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="your.email@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
                {emailError && (
                  <p className="text-sm text-destructive mt-1">{emailError}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input 
                    id="confirmPassword" 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    required 
                  />
                  <button 
                    type="button" 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-sm text-destructive mt-1">{passwordError}</p>
                )}
              </div>
              
              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <div className="text-xs text-muted-foreground">
                By creating an account, you agree to our{' '}
                <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
              </div>
            
              <Button 
                type="submit" 
                className="w-full" 
                disabled={formSubmitting || loading || !!socialLoading}
              >
                {formSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Sign Up'
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
