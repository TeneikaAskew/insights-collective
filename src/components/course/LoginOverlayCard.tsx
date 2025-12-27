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

  return (
    <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        {/* Content - visible but blurred when locked */}
        <div className={isLocked ? "blur-sm opacity-50 pointer-events-none select-none" : ""}>
          {children}
        </div>
        
        {/* Overlay - only shown when locked */}
        {isLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/30">
            <div className="text-center p-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Login or enroll to access
              </p>
              <Button onClick={handleLoginClick} size="sm">
                {actionText}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
