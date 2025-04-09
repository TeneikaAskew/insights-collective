import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/profile');
    } catch (error: any) {
      console.error('Login failed:', error.message);
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid credentials. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const exampleAccounts = [
    {
      email: "admin@ic.tech",
      password: "password",
      role: "Admin"
    },
    {
      email: "john.doe@example.com",
      password: "password",
      role: "Student"
    },
    {
      email: "jane.smith@example.com",
      password: "password",
      role: "Instructor"
    }
  ];

  return (
    <div className="grid h-screen place-items-center">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Enter your email and password to login</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              placeholder="Enter your email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              placeholder="Enter your password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Link to="/register" className="text-sm text-muted-foreground underline underline-offset-4">
            Don't have an account?
          </Link>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </CardFooter>
        <CardContent className="grid gap-4">
          <div className="flex flex-col space-y-1.5">
            <p className="text-sm text-muted-foreground">Example Accounts:</p>
            <ul className="list-disc pl-5">
              {exampleAccounts.map((account, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  {account.email} / {account.password} ({account.role})
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

// Add a Label component
function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
    >
      {children}
    </label>
  );
}
