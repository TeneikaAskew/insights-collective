
import React from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStoreRedirectPath } from '@/hooks/useStoreRedirectPath';

interface LoginWallProps {
  message: string;
  visibleItems?: number;
  totalItems?: number;
  children?: React.ReactNode;
}

const LoginWall = ({ message, visibleItems = 2, totalItems = 10, children }: LoginWallProps) => {
  const location = useLocation();

  // Create login URL with redirect parameter 
  const loginUrl = `/login?redirect=${encodeURIComponent(location.pathname)}`;
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          
          <h2 className="text-2xl font-bold">Sign in Required</h2>
          <p className="text-muted-foreground">{message}</p>
          
          {visibleItems > 0 && totalItems > 0 && (
            <div className="w-full bg-muted h-2 rounded-full overflow-hidden mt-4">
              <div 
                className="bg-primary h-full"
                style={{ width: `${(visibleItems / totalItems) * 100}%` }}
              ></div>
            </div>
          )}
          
          <div className="flex flex-col w-full gap-2 mt-4">
            <Link to={loginUrl} state={{ from: location }}>
              <Button className="w-full">Sign In</Button>
            </Link>
            <Link to="/register" state={{ from: location }}>
              <Button variant="outline" className="w-full">Create Account</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      
      {children}
    </div>
  );
};

export default LoginWall;
