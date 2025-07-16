import { useParams } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { ModuleDragDropOrganizer } from '@/components/course/ModuleDragDropOrganizer';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseOrganizer');

interface Module {
  id: string;
  title: string;
  description?: string;
  order_index: number;
  lessons: Array<{
    id: string;
    title: string;
    type: string;
    order_index: number;
  }>;
}

const CourseOrganizer = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { canEdit, isInstructor } = useCoursePermissions(courseId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch modules with lessons, assignments, and quizzes
  const { data: modules, isLoading } = useQuery({
    queryKey: ['course-modules-organizer', courseId],
    queryFn: async () => {
      if (!courseId) return [];

      // Get modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (modulesError) throw modulesError;

      // Get lessons, assignments, and quizzes for each module
      const modulesWithContent = await Promise.all(
        (modulesData || []).map(async (module) => {
          // Get lessons
          const { data: lessons } = await supabase
            .from('lessons')
            .select('id, title, order_index')
            .eq('module_id', module.id)
            .order('order_index');

          // Get assignments
          const { data: assignments } = await supabase
            .from('assignments')
            .select('id, title')
            .eq('module_id', module.id);

          // Get quizzes
          const { data: quizzes } = await supabase
            .from('quizzes')
            .select('id, title')
            .eq('module_id', module.id);

          // Combine all content items
          const allItems = [
            ...(lessons || []).map(l => ({ ...l, type: 'lesson' as const })),
            ...(assignments || []).map((a, idx) => ({ 
              ...a, 
              type: 'assignment' as const,
              order_index: (lessons?.length || 0) + idx 
            })),
            ...(quizzes || []).map((q, idx) => ({ 
              ...q, 
              type: 'quiz' as const,
              order_index: (lessons?.length || 0) + (assignments?.length || 0) + idx 
            })),
          ].sort((a, b) => a.order_index - b.order_index);

          return {
            ...module,
            lessons: allItems,
          };
        })
      );

      return modulesWithContent;
    },
    enabled: !!courseId && canEdit,
  });

  const saveOrderMutation = useMutation({
    mutationFn: async (updatedModules: Module[]) => {
      // Update module order
      const moduleUpdates = updatedModules.map((module, index) => 
        supabase
          .from('modules')
          .update({ order_index: index })
          .eq('id', module.id)
      );

      // Update lesson order within each module
      const lessonUpdates: any[] = [];
      updatedModules.forEach((module) => {
        module.lessons
          .filter(item => item.type === 'lesson')
          .forEach((lesson, index) => {
            lessonUpdates.push(
              supabase
                .from('lessons')
                .update({ 
                  order_index: index,
                  module_id: module.id 
                })
                .eq('id', lesson.id)
            );
          });
      });

      // Execute all updates
      await Promise.all([...moduleUpdates, ...lessonUpdates]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-modules-organizer', courseId] });
      queryClient.invalidateQueries({ queryKey: ['modules', courseId] });
      toast({
        title: 'Success',
        description: 'Course structure updated successfully',
      });
    },
    onError: (error) => {
      logger.error('Error saving order:', error);
      toast({
        title: 'Error',
        description: 'Failed to update course structure',
        variant: 'destructive',
      });
    },
  });

  if (!canEdit || !isInstructor) {
    return (
      <CourseLayout>
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to organize course content. Only instructors can access this page.
          </AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  if (isLoading) {
    return (
      <CourseLayout>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Organize Course Content</h1>
        
        <ModuleDragDropOrganizer
          courseId={courseId || ''}
          modules={modules || []}
          onSave={saveOrderMutation.mutateAsync}
          canEdit={canEdit}
        />
      </div>
    </CourseLayout>
  );
};

export default CourseOrganizer;