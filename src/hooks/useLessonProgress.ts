// ABOUTME: Hook for tracking lesson completion progress for users
// ABOUTME: Provides lesson progress data and functions to mark lessons as complete

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isValidUUID } from '@/utils/idUtils';

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  completion_percentage: number;
  time_spent: number;
  started_at: string;
  completed_at?: string;
  last_accessed_at: string;
}

export function useLessonProgress(lessonId?: string) {
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!lessonId || !user) {
      setLoading(false);
      return;
    }

    if (!isValidUUID(lessonId)) {
      console.error(`Invalid lesson UUID format: ${lessonId}`);
      setError('Invalid lesson ID format');
      setLoading(false);
      return;
    }

    fetchProgress();
  }, [lessonId, user]);

  const fetchProgress = async () => {
    if (!lessonId || !user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setProgress(data);
    } catch (error: any) {
      console.error('Error fetching lesson progress:', error);
      setError(error.message || 'Failed to load lesson progress');
    } finally {
      setLoading(false);
    }
  };

  const markLessonComplete = async (): Promise<boolean> => {
    if (!lessonId || !user) return false;

    try {
      const progressData = {
        user_id: user.id,
        lesson_id: lessonId,
        completed: true,
        completion_percentage: 100,
        completed_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString()
      };

      if (progress) {
        // Update existing progress
        const { data, error } = await supabase
          .from('lesson_progress')
          .update({
            completed: true,
            completion_percentage: 100,
            completed_at: new Date().toISOString(),
            last_accessed_at: new Date().toISOString()
          })
          .eq('id', progress.id)
          .select()
          .single();

        if (error) throw error;
        setProgress(data);
      } else {
        // Create new progress record
        const { data, error } = await supabase
          .from('lesson_progress')
          .insert(progressData)
          .select()
          .single();

        if (error) throw error;
        setProgress(data);
      }

      toast({
        title: 'Success',
        description: 'Lesson marked as complete',
      });

      return true;
    } catch (error: any) {
      console.error('Error marking lesson complete:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark lesson complete',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateProgress = async (percentage: number, timeSpent?: number): Promise<boolean> => {
    if (!lessonId || !user) return false;

    try {
      const updateData = {
        completion_percentage: Math.min(100, Math.max(0, percentage)),
        last_accessed_at: new Date().toISOString(),
        ...(timeSpent && { time_spent: timeSpent })
      };

      if (progress) {
        const { data, error } = await supabase
          .from('lesson_progress')
          .update(updateData)
          .eq('id', progress.id)
          .select()
          .single();

        if (error) throw error;
        setProgress(data);
      } else {
        const { data, error } = await supabase
          .from('lesson_progress')
          .insert({
            user_id: user.id,
            lesson_id: lessonId,
            ...updateData
          })
          .select()
          .single();

        if (error) throw error;
        setProgress(data);
      }

      return true;
    } catch (error: any) {
      console.error('Error updating lesson progress:', error);
      return false;
    }
  };

  const calculateLessonCompletion = async (): Promise<{
    completed: boolean;
    completion_percentage: number;
    total_blocks: number;
    completed_blocks: number;
  } | null> => {
    if (!lessonId || !user) return null;

    try {
      const { data, error } = await supabase
        .rpc('calculate_lesson_completion', {
          lesson_id_param: lessonId,
          user_id_param: user.id
        });

      if (error) throw error;
      return data?.[0] || null;
    } catch (error: any) {
      console.error('Error calculating lesson completion:', error);
      return null;
    }
  };

  return {
    progress,
    loading,
    error,
    markLessonComplete,
    updateProgress,
    calculateLessonCompletion,
    refetch: fetchProgress
  };
}