// ABOUTME: Course edit page for instructors and admins to edit course content within course context
// ABOUTME: Uses CourseLayout to maintain course context and provides editing interface

import React from 'react';
import { useParams } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { useCourseData } from '@/hooks/useCourseData';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { CourseDetailsForm } from '@/components/course/CourseDetailsForm';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export default function CourseEdit() {
  const { courseId } = useParams<{ courseId: string }>();
  const { course, isLoading, error } = useCourseData(courseId);
  const { canEdit, loading: permissionsLoading } = useCoursePermissions(courseId);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSave = async (updatedCourse: any) => {
    if (!courseId) return;

    try {
      const { error } = await supabase
        .from('courses')
        .update(updatedCourse)
        .eq('id', courseId);

      if (error) throw error;

      toast({
        title: 'Course updated successfully',
        description: 'Your changes have been saved.',
      });

      // Navigate back to course home
      navigate(`/courses/${courseId}`);
    } catch (error: any) {
      toast({
        title: 'Error updating course',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading || permissionsLoading) {
    return (
      <CourseLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Spinner size="lg" />
        </div>
      </CourseLayout>
    );
  }

  if (error) {
    return (
      <CourseLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading course: {error}
          </AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  if (!canEdit) {
    return (
      <CourseLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to edit this course. Only administrators and assigned instructors can edit courses.
          </AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Edit Course</h1>
          </div>
          <p className="text-muted-foreground">
            Update course information, description, and settings.
          </p>
        </div>

        {course && (
          <CourseDetailsForm 
            course={course} 
            onSave={handleSave}
            loading={false}
          />
        )}
      </div>
    </CourseLayout>
  );
}