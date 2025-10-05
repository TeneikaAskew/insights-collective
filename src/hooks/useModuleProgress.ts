import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isValidUUID } from '@/utils/idUtils';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useModuleProgress');

export interface ModuleProgress {
  id: string;
  user_id: string;
  module_id: string;
  completed: boolean;
  completion_percentage: number;
  time_spent: number;
  started_at: string;
  completed_at?: string;
  last_accessed_at: string;
}

export interface AssignmentProgress {
  id: string;
  user_id: string;
  content_block_id: string;
  completed: boolean;
  submitted_at?: string;
  submission_data: any;
  grade?: number;
  feedback?: string;
}

export interface QuizProgress {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  completed_at: string;
  answers: any;
}

export function useModuleProgress(moduleId?: string) {
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress | null>(null);
  const [assignmentProgress, setAssignmentProgress] = useState<AssignmentProgress[]>([]);
  const [quizProgress, setQuizProgress] = useState<QuizProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!moduleId || !user) {
      setLoading(false);
      return;
    }

    if (!isValidUUID(moduleId)) {
      logger.error(`Invalid module UUID format: ${moduleId}`);
      setError('Invalid module ID format');
      setLoading(false);
      return;
    }

    fetchProgress();
  }, [moduleId, user]);

  const fetchProgress = async () => {
    if (!moduleId || !user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch module progress
      const { data: moduleData, error: moduleError } = await supabase
        .from('module_progress')
        .select('*')
        .eq('module_id', moduleId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (moduleError) throw moduleError;
      setModuleProgress(moduleData);

      // Fetch assignment progress for this module
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignment_progress')
        .select(`
          *,
          content_blocks!inner(module_id)
        `)
        .eq('content_blocks.module_id', moduleId)
        .eq('user_id', user.id);

      if (assignmentError) throw assignmentError;
      setAssignmentProgress(assignmentData || []);

      // Fetch quiz progress for this module
      const { data: quizData, error: quizError } = await supabase
        .from('quiz_attempts')
        .select(`
          *,
          quizzes!inner(
            content_blocks!inner(module_id)
          )
        `)
        .eq('quizzes.content_blocks.module_id', moduleId)
        .eq('user_id', user.id);

      if (quizError) throw quizError;
      setQuizProgress(quizData || []);

    } catch (error: any) {
      logger.error('Error fetching module progress:', error);
      setError(error.message || 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  const markModuleComplete = async (): Promise<boolean> => {
    if (!moduleId || !user) return false;

    try {
      const progressData = {
        user_id: user.id,
        module_id: moduleId,
        completed: true,
        completion_percentage: 100,
        completed_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('module_progress')
        .upsert(progressData, {
          onConflict: 'user_id,module_id'
        })
        .select()
        .single();

      if (error) throw error;

      setModuleProgress(data);
      
      toast({
        title: 'Success',
        description: 'Module marked as complete!',
      });

      return true;
    } catch (error: any) {
      logger.error('Error marking module as complete:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to mark module as complete',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateModuleProgress = async (percentage: number, timeSpent?: number): Promise<boolean> => {
    if (!moduleId || !user) return false;

    try {
      const progressData = {
        user_id: user.id,
        module_id: moduleId,
        completion_percentage: Math.min(100, Math.max(0, percentage)),
        completed: percentage >= 100,
        last_accessed_at: new Date().toISOString(),
        ...(timeSpent !== undefined && { time_spent: timeSpent }),
        ...(percentage >= 100 && { completed_at: new Date().toISOString() })
      };

      const { data, error } = await supabase
        .from('module_progress')
        .upsert(progressData, {
          onConflict: 'user_id,module_id'
        })
        .select()
        .single();

      if (error) throw error;

      setModuleProgress(data);
      return true;
    } catch (error: any) {
      logger.error('Error updating module progress:', error);
      return false;
    }
  };

  const submitAssignment = async (contentItemId: string, submissionData: any): Promise<boolean> => {
    if (!user) return false;

    try {
      // Use content_item_progressions instead of assignment_progress
      const { data, error } = await supabase
        .from('content_item_progressions')
        .upsert({
          user_id: user.id,
          content_item_id: contentItemId,
          workflow_state: 'submitted'
        }, {
          onConflict: 'user_id,content_item_id'
        })
        .select()
        .single();

      if (error) throw error;

      // Also update assignment_submissions if it's an assignment
      const { data: contentItem } = await supabase
        .from('content_items')
        .select('type, settings')
        .eq('id', contentItemId)
        .single();

      if (contentItem?.type === 'assignment') {
        await supabase
          .from('assignment_submissions')
          .upsert({
            user_id: user.id,
            assignment_id: contentItemId,
            submitted_at: new Date().toISOString(),
            workflow_state: 'submitted',
            body: JSON.stringify(submissionData)
          }, {
            onConflict: 'user_id,assignment_id'
          });
      }

      // Update local state
      setAssignmentProgress(prev => {
        const existingIndex = prev.findIndex(a => a.content_block_id === contentItemId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...data, content_block_id: contentItemId };
          return updated;
        }
        return [...prev, data];
      });

      toast({
        title: 'Success',
        description: 'Assignment submitted successfully!',
      });

      return true;
    } catch (error: any) {
      logger.error('Error submitting assignment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit assignment',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    moduleProgress,
    assignmentProgress,
    quizProgress,
    loading,
    error,
    markModuleComplete,
    updateModuleProgress,
    submitAssignment,
    refetch: fetchProgress
  };
}