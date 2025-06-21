
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user && lessonId) {
      fetchProgress();
    }
  }, [user, lessonId]);

  const fetchProgress = async () => {
    if (!user || !lessonId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (error) throw error;
      setProgress(data);
    } catch (error) {
      console.error('Error fetching lesson progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (
    completed: boolean,
    completionPercentage: number = 0,
    timeSpent: number = 0
  ): Promise<boolean> => {
    if (!user || !lessonId) return false;

    try {
      const updateData = {
        user_id: user.id,
        lesson_id: lessonId,
        completed,
        completion_percentage: completionPercentage,
        time_spent: timeSpent,
        last_accessed_at: new Date().toISOString(),
        ...(completed && { completed_at: new Date().toISOString() })
      };

      const { data, error } = await supabase
        .from('lesson_progress')
        .upsert(updateData, { 
          onConflict: 'user_id,lesson_id' 
        })
        .select()
        .single();

      if (error) throw error;

      setProgress(data);
      return true;
    } catch (error) {
      console.error('Error updating lesson progress:', error);
      toast({
        title: 'Error',
        description: 'Failed to update progress',
        variant: 'destructive'
      });
      return false;
    }
  };

  const markComplete = async () => {
    return updateProgress(true, 100);
  };

  const markIncomplete = async () => {
    return updateProgress(false, 0);
  };

  return {
    progress,
    loading,
    updateProgress,
    markComplete,
    markIncomplete,
    refetch: fetchProgress
  };
}
