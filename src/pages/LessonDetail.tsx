// ABOUTME: Lesson detail page that displays lesson content from Supabase.
// ABOUTME: Fetches course, module, and lesson data from DB and tracks progress via lesson_progress table.

import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { CourseLayout } from '@/components/course/CourseLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { CheckCircle, Clock, Book, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/utils/logger';

const logger = createLogger('LessonDetail');

const LessonDetail = () => {
  const { courseId, moduleId, lessonId } = useParams<{ 
    courseId: string; 
    moduleId: string; 
    lessonId: string; 
  }>();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .eq('id', courseId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const { data: module, isLoading: moduleLoading } = useQuery({
    queryKey: ['module', moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modules')
        .select('id, title')
        .eq('id', moduleId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!moduleId,
  });

  const { data: lesson, isLoading: lessonLoading } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('id, title, description, content, duration, module_id')
        .eq('id', lessonId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId,
  });

  const { data: progress } = useQuery({
    queryKey: ['lesson-progress', lessonId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('completed, completion_percentage, completed_at')
        .eq('lesson_id', lessonId!)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId && !!user,
  });

  const isLoading = courseLoading || moduleLoading || lessonLoading;
  const isCompleted = progress?.completed ?? false;

  if (isLoading) {
    return (
      <CourseLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </CourseLayout>
    );
  }

  if (!course || !module || !lesson) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Lesson Not Found</h1>
          <p className="text-muted-foreground mb-6">The lesson you're looking for doesn't exist or has been removed.</p>
          <Button asChild>
            <Link to={`/courses/${courseId}/modules/${moduleId}`}>Back to Module</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const handleMarkComplete = async () => {
    if (!user) {
      toast({ title: 'Please log in', description: 'You need to be logged in to track progress', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('lesson_progress')
        .upsert({
          user_id: user.id,
          lesson_id: lessonId!,
          completed: true,
          completion_percentage: 100,
          completed_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,lesson_id' });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['lesson-progress', lessonId, user.id] });
      toast({ title: 'Lesson marked as complete', description: 'Your progress has been updated' });
    } catch (err: any) {
      logger.error('Error marking lesson complete:', err);
      toast({ title: 'Error', description: err.message || 'Failed to mark lesson as complete', variant: 'destructive' });
    }
  };

  return (
    <CourseLayout>
      <div className="space-y-6">
        {/* Lesson Header with Breadcrumb */}
        <div className="bg-card border rounded-lg p-4 sm:p-6">
          <Breadcrumb className="mb-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={isAuthenticated ? "/enrolled-courses" : "/courses"}>Courses</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={`/courses/${courseId}`}>{course.title}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={`/courses/${courseId}/modules/${moduleId}`}>{module.title}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{lesson.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold mb-2 break-words">{lesson.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {lesson.duration && (
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span>{lesson.duration}</span>
                  </div>
                )}
                <div className="flex items-center">
                  <Book className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span className="truncate">{module.title}</span>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              {isCompleted ? (
                <Badge className="bg-green-500 text-white">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="outline">Not Completed</Badge>
              )}
            </div>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Lesson Content</CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="aspect-video bg-secondary rounded-lg mb-6 flex items-center justify-center">
              <div className="text-center p-4">
                <Clock className="h-16 w-16 mx-auto mb-2 opacity-50" />
                <p className="text-lg font-medium">Video Player</p>
                <p className="text-sm opacity-70 mt-1">Lesson content would be displayed here</p>
              </div>
            </div>
            
            <div className="prose max-w-none">
              {lesson.description && (
                <>
                  <h3 className="text-lg font-semibold mb-2">Lesson Description</h3>
                  <p className="mb-4">{lesson.description}</p>
                </>
              )}
              
              {lesson.content && (
                <>
                  <h3 className="text-lg font-semibold mb-2">Lesson Content</h3>
                  <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
                </>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="justify-end">
            <div className="space-x-2">
              {!isCompleted && (
                <Button onClick={handleMarkComplete}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Complete
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </CourseLayout>
  );
};

export default LessonDetail;
