
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/types';
import { mockService } from '@/lib/mockData';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real app, this would make an API call to authenticate
      // For demo purposes, we're using hardcoded credentials
      if (email === 'john.doe@example.com' && password === 'password') {
        const user = mockService.getUserById('user1');
        if (user) {
          setUser(user);
          localStorage.setItem('user', JSON.stringify(user));
          toast({
            title: 'Success',
            description: 'Logged in successfully',
            variant: 'default',
          });
          navigate('/dashboard');
        } else {
          throw new Error('User not found');
        }
      } else if (email === 'jane.smith@example.com' && password === 'password') {
        const user = mockService.getUserById('user2');
        if (user) {
          setUser(user);
          localStorage.setItem('user', JSON.stringify(user));
          toast({
            title: 'Success',
            description: 'Logged in successfully',
            variant: 'default',
          });
          navigate('/dashboard');
        } else {
          throw new Error('User not found');
        }
      } else if (email === 'admin@learnflow.com' && password === 'password') {
        const user = mockService.getUserById('user3');
        if (user) {
          setUser(user);
          localStorage.setItem('user', JSON.stringify(user));
          toast({
            title: 'Success',
            description: 'Logged in successfully',
            variant: 'default',
          });
          navigate('/admin');
        } else {
          throw new Error('User not found');
        }
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setError('An unknown error occurred');
        toast({
          title: 'Error',
          description: 'An unknown error occurred',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real app, this would make an API call to register
      // For demo purposes, we'll just check if the email is already in use
      const existingUser = mockService.getUserById('user1');
      if (existingUser && existingUser.email === email) {
        throw new Error('Email already in use');
      }
      
      // Simulate successful registration
      toast({
        title: 'Success',
        description: 'Account created successfully',
        variant: 'default',
      });
      
      // Automatically log in the user
      await login(email, password);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setError('An unknown error occurred');
        toast({
          title: 'Error',
          description: 'An unknown error occurred',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    toast({
      title: 'Success',
      description: 'Logged out successfully',
      variant: 'default',
    });
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      error, 
      login, 
      register, 
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
