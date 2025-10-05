// ABOUTME: Single Edit Course button component to prevent duplication
// ABOUTME: Only shows for users with edit permissions (instructors/admins)

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';

interface EditCourseButtonProps {
  courseId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function EditCourseButton({ 
  courseId, 
  variant = 'outline', 
  size = 'default',
  className 
}: EditCourseButtonProps) {
  const { canEdit, loading } = useCoursePermissions(courseId);

  if (loading || !canEdit) {
    return null;
  }

  return (
    <Button variant={variant} size={size} className={className} asChild>
      <Link to={`/courses/${courseId}/edit`}>
        <Edit className="h-4 w-4 mr-2" />
        Edit Course
      </Link>
    </Button>
  );
}