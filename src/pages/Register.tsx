
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { FaGoogle } from 'react-icons/fa';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  
  const {
    register,
    googleSignIn,
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

  // Enhanced email validation function
  const validateEmail = (email: string): { isValid: boolean; message: string } => {
    if (!email.trim()) {
      return { isValid: false, message: 'Email is required' };
    }
    
    // More comprehensive email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email)) {
      return { isValid: false, message: 'Please enter a valid email address (e.g., user@example.com)' };
    }
    
    // Additional checks for common email issues
    if (email.includes('..')) {
      return { isValid: false, message: 'Email cannot contain consecutive dots' };
    }
    
    if (email.startsWith('.') || email.endsWith('.')) {
      return { isValid: false, message: 'Email cannot start or end with a dot' };
    }
    
    return { isValid: true, message: '' };
  };

  // Enhanced password validation function
  const validatePassword = (password: string): { isValid: boolean; message: string } => {
    if (!password) {
      return { isValid: false, message: 'Password is required' };
    }
    
    if (password.length < 6) {
      return { isValid: false, message: 'Password must be at least 6 characters long' };
    }
    
    // Additional password strength checks
    if (password.length > 72) {
      return { isValid: false, message: 'Password must be less than 72 characters' };
    }
    
    return { isValid: true, message: '' };
  };

  const clearErrors = () => {
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setGeneralError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Starting registration process...');
    
    clearErrors();
    let hasErrors = false;
    
    // Validate name
    if (!name.trim()) {
      setNameError('Please enter your full name');
      hasErrors = true;
    }
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.message);
      hasErrors = true;
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.message);
      hasErrors = true;
    }
    
    // Check password confirmation
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      hasErrors = true;
    }

    if (hasErrors) {
      toast({
        title: 'Please fix the errors below',
        description: 'Check the highlighted fields and correct any errors.',
        variant: 'destructive',
      });
      return;
    }

    setFormSubmitting(true);
    
    try {
      console.log('Attempting to register with:', { name: name.trim(), email: email.trim().toLowerCase() });
      
      storeCurrentPath();
      await register(name.trim(), email.trim().toLowerCase(), password);
      
      console.log('Registration successful');
      
      // Show success message
      toast({
        title: 'Registration Successful',
        description: 'Please check your email to verify your account before signing in.',
        variant: 'default',
      });
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Parse and display specific error messages
      let errorMessage = error.message || 'An error occurred during registration. Please try again.';
      
      // Handle specific Supabase error types
      if (errorMessage.includes('Email address') && errorMessage.includes('is invalid')) {
        setEmailError('This email address is not valid. Please check the format and try again.');
        toast({
          title: 'Invalid Email',
          description: 'Please enter a valid email address.',
          variant: 'destructive',
        });
      } else if (errorMessage.includes('User already registered') || errorMessage.includes('already exists')) {
        setEmailError('An account with this email already exists. Please try signing in instead.');
        toast({
          title: 'Account Exists',
          description: 'An account with this email already exists. Please try signing in instead.',
          variant: 'destructive',
        });
      } else if (errorMessage.includes('password')) {
        setPasswordError('Password does not meet requirements. Please try a different password.');
        toast({
          title: 'Password Error',
          description: 'Password does not meet requirements.',
          variant: 'destructive',
        });
      } else if (errorMessage.includes('signup_disabled')) {
        setGeneralError('User registration is currently disabled. Please contact support.');
        toast({
          title: 'Registration Disabled',
          description: 'User registration is currently disabled. Please contact support.',
          variant: 'destructive',
        });
      } else {
        setGeneralError(errorMessage);
        toast({
          title: 'Registration Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSocialSignIn = async (provider: 'google') => {
    try {
      setSocialLoading(provider);
      clearErrors();

      // Store path for redirect before social sign-in
      const from = location.state?.from?.pathname;
      const query = new URLSearchParams(location.search);
      const redirectParam = query.get('redirect');
      const redirectPath = redirectParam || from || '/resources';
      
      localStorage.setItem('redirectAfterLogin', redirectPath);
      console.log('[Register] Stored redirect path before social sign-in:', redirectPath);
      
      await googleSignIn();
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
            {/* General error display */}
            {(generalError || error) && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {generalError || error}
                </AlertDescription>
              </Alert>
            )}
            
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
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError('');
                  }} 
                  required 
                  disabled={formSubmitting || loading}
                  className={nameError ? 'border-red-500 focus:border-red-500' : ''}
                />
                {nameError && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {nameError}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="user@example.com" 
                  value={email} 
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                  }} 
                  required 
                  disabled={formSubmitting || loading}
                  className={emailError ? 'border-red-500 focus:border-red-500' : ''}
                />
                {emailError && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {emailError}
                  </p>
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
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError('');
                    }} 
                    required 
                    disabled={formSubmitting || loading}
                    className={passwordError ? 'border-red-500 focus:border-red-500' : ''}
                  />
                  <button 
                    type="button" 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" 
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={formSubmitting || loading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {passwordError}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input 
                    id="confirmPassword" 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    value={confirmPassword} 
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setConfirmPasswordError('');
                    }} 
                    required 
                    disabled={formSubmitting || loading}
                    className={confirmPasswordError ? 'border-red-500 focus:border-red-500' : ''}
                  />
                  <button 
                    type="button" 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={formSubmitting || loading}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPasswordError && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {confirmPasswordError}
                  </p>
                )}
              </div>
              
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
