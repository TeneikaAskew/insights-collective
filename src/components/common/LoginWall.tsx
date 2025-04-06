
import React from 'react';
import { Button } from '@/components/ui/button';
import { LockIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LoginWallProps {
  message: string;
  visibleItems: number;
  totalItems: number;
}

const LoginWall = ({ message, visibleItems, totalItems }: LoginWallProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="relative">
      {/* Overlay with blurred background */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-10 rounded-lg border border-primary/20">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <LockIcon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Content Locked</h3>
        <p className="text-lg mb-2">
          You're viewing {visibleItems} of {totalItems} items
        </p>
        <p className="text-muted-foreground mb-6 max-w-md">
          {message}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button size="lg" onClick={() => navigate('/login')}>
            Sign In
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/register')}>
            Create Account
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoginWall;
