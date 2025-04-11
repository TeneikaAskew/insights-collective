
import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUp } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ResumeLoginWall = () => {
  // Get current path for redirect after login
  const location = useLocation();
  const { storeRedirectPath } = useAuth();
  const loginUrl = `/login?redirect=${encodeURIComponent(location.pathname)}`;
  
  // Store the current path for redirect after login
  useEffect(() => {
    storeRedirectPath(location.pathname);
    console.log('ResumeLoginWall: stored path:', location.pathname);
  }, [location.pathname, storeRedirectPath]);
  
  return (
    <div className="container mx-auto py-12">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Resume Analysis</CardTitle>
          <CardDescription>
            Sign in to upload your resume and get detailed AI-powered analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8 space-y-6">
          <div className="bg-accent/20 rounded-full p-6">
            <FileUp className="h-12 w-12 text-accent" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">
              Get Your Resume Analyzed
            </h3>
            <p className="text-muted-foreground mb-4">
              Our AI will analyze your resume, provide suggestions for improvement, 
              and help you stand out to potential employers.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col">
          <Button asChild className="w-full">
            <Link to={loginUrl} state={{ from: location }}>Sign In to Continue</Link>
          </Button>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Don't have an account? <Link to="/register" className="text-primary hover:underline">Register</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ResumeLoginWall;
