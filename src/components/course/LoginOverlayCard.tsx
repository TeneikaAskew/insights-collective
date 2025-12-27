// ABOUTME: Card wrapper that adds a blur overlay with login prompt for non-enrolled users
// ABOUTME: Used to encourage users to login/enroll to access course content

import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface LoginOverlayCardProps {
  children: ReactNode;
  title: string;
  icon: ReactNode;
  isLocked: boolean;
  courseId?: string;
  actionText?: string;
}

export function LoginOverlayCard({ 
  children, 
  title, 
  icon, 
  isLocked, 
  courseId,
  actionText = "Login to Access"
}: LoginOverlayCardProps) {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    if (courseId) {
      localStorage.setItem('redirectAfterLogin', `/courses/${courseId}`);
    }
    navigate('/login', {
      state: {
        from: courseId ? `/courses/${courseId}` : '/'
      }
    });
  };

  if (!isLocked) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        {/* Blurred content */}
        <div className="blur-[6px] pointer-events-none select-none opacity-50">
          {children}
        </div>
        
        {/* Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Login or enroll to access this content
            </p>
            <Button onClick={handleLoginClick} size="sm">
              {actionText}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
