import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lessonCompletionService } from '@/services/lessonCompletionService';
import { useToast } from '@/hooks/use-toast';
import { LessonCompletionRequirement } from '@/types/course';

export const useLessonCompletion = (lessonId: string, studentId: string) => {
  return useQuery({
    queryKey: ['lesson-completion', lessonId, studentId],
    queryFn: () => lessonCompletionService.getLessonCompletion(lessonId, studentId),
    enabled: !!lessonId && !!studentId,
  });
};

export const useModuleCompletions = (moduleId: string, studentId: string) => {
  return useQuery({
    queryKey: ['module-completions', moduleId, studentId],
    queryFn: () => lessonCompletionService.getModuleCompletions(moduleId, studentId),
    enabled: !!moduleId && !!studentId,
  });
};

export const useCourseCompletions = (courseId: string, studentId: string) => {
  return useQuery({
    queryKey: ['course-completions', courseId, studentId],
    queryFn: () => lessonCompletionService.getCourseCompletions(courseId, studentId),
    enabled: !!courseId && !!studentId,
  });
};

export const useMarkLessonComplete = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ lessonId, studentId, method }: {
      lessonId: string;
      studentId: string;
      method?: 'manual' | 'automatic' | 'requirement_met';
    }) => lessonCompletionService.markLessonComplete(lessonId, studentId, method),
    onSuccess: (result, variables) => {
      if (!result.alreadyCompleted) {
        queryClient.invalidateQueries({ queryKey: ['lesson-completion', variables.lessonId] });
        queryClient.invalidateQueries({ queryKey: ['module-completions'] });
        queryClient.invalidateQueries({ queryKey: ['course-completions'] });
        queryClient.invalidateQueries({ queryKey: ['module-progress'] });
        queryClient.invalidateQueries({ queryKey: ['course-progress'] });
        
        toast({
          title: 'Success',
          description: 'Lesson marked as complete',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useMarkLessonIncomplete = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ lessonId, studentId }: {
      lessonId: string;
      studentId: string;
    }) => lessonCompletionService.markLessonIncomplete(lessonId, studentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-completion', variables.lessonId] });
      queryClient.invalidateQueries({ queryKey: ['module-completions'] });
      queryClient.invalidateQueries({ queryKey: ['course-completions'] });
      queryClient.invalidateQueries({ queryKey: ['module-progress'] });
      queryClient.invalidateQueries({ queryKey: ['course-progress'] });
      
      toast({
        title: 'Success',
        description: 'Lesson marked as incomplete',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useLessonRequirements = (lessonId: string) => {
  return useQuery({
    queryKey: ['lesson-requirements', lessonId],
    queryFn: () => lessonCompletionService.getLessonRequirements(lessonId),
    enabled: !!lessonId,
  });
};

export const useSetLessonRequirements = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ lessonId, requirements }: {
      lessonId: string;
      requirements: Omit<LessonCompletionRequirement, 'id' | 'lesson_id' | 'created_at'>[];
    }) => lessonCompletionService.setLessonRequirements(lessonId, requirements),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-requirements', variables.lessonId] });
      toast({
        title: 'Success',
        description: 'Lesson requirements updated',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useCheckLessonRequirements = (lessonId: string, studentId: string) => {
  return useQuery({
    queryKey: ['lesson-requirements-check', lessonId, studentId],
    queryFn: () => lessonCompletionService.checkLessonRequirements(lessonId, studentId),
    enabled: !!lessonId && !!studentId,
  });
};

export const useTrackLessonView = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lessonId, studentId }: {
      lessonId: string;
      studentId: string;
    }) => lessonCompletionService.trackLessonView(lessonId, studentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-completion', variables.lessonId] });
      queryClient.invalidateQueries({ queryKey: ['lesson-requirements-check', variables.lessonId] });
    },
  });
};