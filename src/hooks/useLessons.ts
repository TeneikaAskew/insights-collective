import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isValidUUID } from '@/utils/idUtils';
import { Lesson, LessonInput } from '@/types/lesson';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useLessons');

export function useLessons(moduleId?: string) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!moduleId) {
      setLoading(false);
      return;
    }

    if (!isValidUUID(moduleId)) {
      logger.error(`Invalid module UUID format: ${moduleId}`);
      setError('Invalid module ID format');
      setLoading(false);
      return;
    }

    fetchLessons();
  }, [moduleId]);

  const fetchLessons = async () => {
    if (!moduleId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('module_id', moduleId)
        .order('order_num', { ascending: true });

      if (error) throw error;
      setLessons((data || []) as unknown as Lesson[]);
    } catch (error: any) {
      logger.error('Error fetching lessons:', error);
      setError(error.message || 'Failed to load lessons');
      toast({
        title: 'Error',
        description: 'Failed to load lessons',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addLesson = async (lessonData: LessonInput): Promise<Lesson | null> => {
    if (!user || !moduleId) return null;

    try {
      const { data, error } = await supabase
        .from('lessons')
        .insert({
          ...lessonData,
          module_id: moduleId,
          content_blocks_count: 0
        })
        .select()
        .single();

      if (error) throw error;

      setLessons(prev => [...prev, data as unknown as Lesson]);
      
      toast({
        title: 'Success',
        description: 'Lesson added successfully',
      });

      return data as unknown as Lesson;
    } catch (error: any) {
      logger.error('Error adding lesson:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add lesson',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateLesson = async (id: string, updates: Partial<LessonInput>): Promise<Lesson | null> => {
    if (!isValidUUID(id)) {
      logger.error(`Invalid lesson UUID format: ${id}`);
      toast({
        title: 'Error',
        description: 'Invalid lesson ID format',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('lessons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setLessons(prev => prev.map(lesson => lesson.id === id ? (data as unknown as Lesson) : lesson));
      
      toast({
        title: 'Success',
        description: 'Lesson updated successfully',
      });

      return data as unknown as Lesson;
    } catch (error: any) {
      logger.error('Error updating lesson:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update lesson',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteLesson = async (id: string): Promise<boolean> => {
    if (!isValidUUID(id)) {
      logger.error(`Invalid lesson UUID format: ${id}`);
      toast({
        title: 'Error',
        description: 'Invalid lesson ID format',
        variant: 'destructive',
      });
      return false;
    }

    try {
      // Delete lesson progress
      const { error: progressError } = await supabase
        .from('lesson_progress')
        .delete()
        .eq('lesson_id', id);

      if (progressError) throw progressError;

      // Delete the lesson
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLessons(prev => prev.filter(lesson => lesson.id !== id));
      
      toast({
        title: 'Success',
        description: 'Lesson deleted successfully',
      });

      return true;
    } catch (error: any) {
      logger.error('Error deleting lesson:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete lesson',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    lessons,
    loading,
    error,
    addLesson,
    updateLesson,
    deleteLesson,
    refetch: fetchLessons
  };
}