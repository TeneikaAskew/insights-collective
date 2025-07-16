// ABOUTME: Course edit page for instructors and admins to edit course content within course context
// ABOUTME: Uses CourseLayout to maintain course context and provides editing interface

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { useCourseData } from '@/hooks/useCourseData';
import { CourseDetailsForm } from '@/components/course/CourseDetailsForm';
import { CourseContentManager } from '@/components/course/CourseContentManager';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertCircle, BookOpen, BookOpenCheck, FileText, HelpCircle, Settings, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { withCourseEditPermission } from '@/components/course/withCoursePermission';

function CourseEdit() {
  const { courseId } = useParams<{ courseId: string }>();
  const { course, isLoading, error } = useCourseData(courseId);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('details');

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

  if (isLoading) {
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

  return (
    <CourseLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Edit Course</h1>
            </div>
            <Button asChild variant="outline">
              <Link to={`/courses/${courseId}`}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Return to Course
              </Link>
            </Button>
          </div>
          <p className="text-muted-foreground">
            Manage course content, modules, assignments, and settings.
          </p>
        </div>

        {course && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="content" className="flex items-center gap-2">
                <BookOpenCheck className="h-4 w-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="assignments" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Assignments
              </TabsTrigger>
              <TabsTrigger value="quizzes" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Quizzes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-6">
              <CourseDetailsForm 
                course={course} 
                onSave={handleSave}
                loading={false}
              />
            </TabsContent>

            <TabsContent value="content" className="mt-6">
              <CourseContentManager 
                courseId={courseId!} 
                contentType="modules"
              />
            </TabsContent>

            <TabsContent value="assignments" className="mt-6">
              <CourseContentManager 
                courseId={courseId!} 
                contentType="assignments"
              />
            </TabsContent>

            <TabsContent value="quizzes" className="mt-6">
              <CourseContentManager 
                courseId={courseId!} 
                contentType="quizzes"
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </CourseLayout>
  );
}

export default withCourseEditPermission(CourseEdit);