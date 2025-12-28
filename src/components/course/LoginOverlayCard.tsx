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
  actionText = 'Login to Access'
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
    <Card className="hover:shadow-md transition-shadow relative">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={isLocked ? 'relative min-h-[140px]' : 'relative'}>
        {/* Content - visible but blurred when locked */}
        <div className={isLocked ? 'blur-sm opacity-50 pointer-events-none select-none' : ''}>
          {children}
        </div>

        {/* Overlay - only shown when locked */}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-background/50 backdrop-blur-sm">
            <div className="w-full max-w-[280px] text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Login or enroll to access
              </p>
              <Button onClick={handleLoginClick} size="sm" className="w-full">
                {actionText}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
