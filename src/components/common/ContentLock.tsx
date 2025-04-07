
import { useState, useEffect } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface ContentLockProps {
  children: React.ReactNode;
}

export const ContentLock = ({ children }: ContentLockProps) => {
  const [isLocked, setIsLocked] = useState(false);
  
  useEffect(() => {
    // Check if this is the first visit
    const visitCount = localStorage.getItem('visitsCount');
    
    if (!visitCount) {
      // First visit - don't lock content yet
      localStorage.setItem('visitsCount', '1');
      setIsLocked(false);
    } else {
      // Second or later visit - lock the content
      const count = parseInt(visitCount, 10);
      localStorage.setItem('visitsCount', (count + 1).toString());
      setIsLocked(count >= 1); // Lock only from second visit onwards
    }
  }, []);
  
  if (!isLocked) {
    return <>{children}</>;
  }
  
  return (
    <div className="p-8 bg-white/90 backdrop-blur-sm border rounded-lg shadow-lg">
      <div className="text-center space-y-4">
        <div className="mx-auto bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center">
          <LockKeyhole className="h-10 w-10 text-orange-600" />
        </div>
        <h3 className="text-xl font-bold">Premium Content</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          This content is available to registered users. Sign up for free to access all the tools and resources.
        </p>
        <div className="pt-4 flex gap-4 justify-center">
          <Button asChild variant="outline">
            <Link to="/login">Log In</Link>
          </Button>
          <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
            <Link to="/register">Create Free Account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
