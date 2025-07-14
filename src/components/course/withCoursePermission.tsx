// ABOUTME: Higher-order component for protecting course-related pages with permission checks
// ABOUTME: Ensures only users with proper permissions can access course editing and management pages

import React from 'react';
import { useParams } from 'react-router-dom';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

interface WithCoursePermissionProps {
  requiredRoles?: string[];
  fallbackPath?: string;
}

export function withCoursePermission<T extends object>(
  Component: React.ComponentType<T>,
  options: WithCoursePermissionProps = {}
) {
  const { requiredRoles = ['admin', 'instructor'], fallbackPath = '/courses' } = options;
  
  return function PermissionWrappedComponent(props: T) {
    const { courseId } = useParams<{ courseId: string }>();
    const { user, isAuthenticated } = useAuth();
    const { canEdit, loading, isAdmin, isInstructor, error } = useCoursePermissions(courseId);
    
    // Check if user is authenticated
    if (!isAuthenticated || !user) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You must be logged in to access this page.
            </AlertDescription>
          </Alert>
          <Button asChild>
            <Link to="/login">Login</Link>
          </Button>
        </div>
      );
    }
    
    // Loading state
    if (loading) {
      return (
        <div className="flex justify-center items-center min-h-[50vh]">
          <Spinner size="lg" />
        </div>
      );
    }
    
    // Error state
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error checking permissions: {error}
            </AlertDescription>
          </Alert>
          <Button asChild>
            <Link to={fallbackPath}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Link>
          </Button>
        </div>
      );
    }
    
    // Permission check
    const hasRequiredRole = requiredRoles.some(role => {
      if (role === 'admin') return isAdmin;
      if (role === 'instructor') return isInstructor || canEdit;
      return false;
    });
    
    if (!hasRequiredRole) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to access this page. 
              {requiredRoles.includes('admin') && requiredRoles.includes('instructor') 
                ? ' Only administrators and course instructors can access this page.'
                : requiredRoles.includes('admin') 
                  ? ' Only administrators can access this page.'
                  : ' Only course instructors can access this page.'
              }
            </AlertDescription>
          </Alert>
          <Button asChild>
            <Link to={fallbackPath}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Courses
            </Link>
          </Button>
        </div>
      );
    }
    
    // If all checks pass, render the component
    return <Component {...props} />;
  };
}

// Convenience exports for common permission combinations
export const withAdminPermission = <T extends object>(Component: React.ComponentType<T>) =>
  withCoursePermission(Component, { requiredRoles: ['admin'] });

export const withInstructorPermission = <T extends object>(Component: React.ComponentType<T>) =>
  withCoursePermission(Component, { requiredRoles: ['instructor', 'admin'] });

export const withCourseEditPermission = <T extends object>(Component: React.ComponentType<T>) =>
  withCoursePermission(Component, { requiredRoles: ['instructor', 'admin'] });