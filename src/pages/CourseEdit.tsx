// ABOUTME: Course edit page for instructors and admins to edit course content within course context
// ABOUTME: Uses CourseLayout to maintain course context and provides editing interface

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { useCourseData } from '@/hooks/useCourseData';
import { CourseDetailsForm } from '@/components/course/CourseDetailsForm';
import WeekBasedModuleManager from '@/components/course/management/WeekBasedModuleManager';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, BookOpen, BookOpenCheck, FileText, HelpCircle, Settings } from 'lucide-react';
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
      console.log('Saving course with data:', updatedCourse);
      
      // Transform camelCase form data to snake_case database fields
      // and filter out fields that shouldn't be updated
      const courseData = {
        title: updatedCourse.title,
        description: updatedCourse.description,
        category: updatedCourse.category,
        level: updatedCourse.level,
        duration: updatedCourse.duration,
        thumbnail: updatedCourse.thumbnail,
        image_url: updatedCourse.imageUrl,
        enrollment_status: updatedCourse.enrollmentStatus,
        tags: updatedCourse.tags,
        published: updatedCourse.published,
        status: updatedCourse.published ? 'published' : 'draft',
      };

      // Remove undefined fields
      const cleanedData = Object.fromEntries(
        Object.entries(courseData).filter(([_, value]) => value !== undefined)
      );

      console.log('Cleaned data for database:', cleanedData);
      
      const { data, error } = await supabase
        .from('courses')
        .update(cleanedData)
        .eq('id', courseId)
        .select('*')
        .single();

      if (error) {
        console.error('Save error:', error);
        throw error;
      }

      console.log('Course saved successfully, updated data:', data);

      toast({
        title: 'Course updated successfully',
        description: 'Your changes have been saved.',
      });

      // Refresh the page to show updated data
      window.location.reload();

    } catch (error: any) {
      console.error('Error saving course:', error);
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
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Edit Course</h1>
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
              <WeekBasedModuleManager 
                courseId={courseId!} 
                courseDuration={parseInt(course.duration?.toString() || '1')}
              />
            </TabsContent>

            <TabsContent value="assignments" className="mt-6">
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Assignments</h3>
                <p className="text-muted-foreground">Assignment management coming soon</p>
              </div>
            </TabsContent>

            <TabsContent value="quizzes" className="mt-6">
              <div className="text-center py-12">
                <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Quizzes</h3>
                <p className="text-muted-foreground">Quiz management coming soon</p>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </CourseLayout>
  );
}

export default withCourseEditPermission(CourseEdit);