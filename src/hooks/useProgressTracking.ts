import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useProgressTracking');

export interface ContentProgress {
  id: string;
  user_id: string;
  content_block_id: string;
  completed: boolean;
  completion_percentage: number;
  time_spent: number;
  last_accessed_at: string;
  completed_at?: string;
}

export interface ModuleProgress {
  module_id: string;
  module_title: string;
  total_blocks: number;
  completed_blocks: number;
  completion_percentage: number;
  time_spent: number;
  last_accessed: string;
}

export interface CourseProgress {
  course_id: string;
  course_title: string;
  total_modules: number;
  completed_modules: number;
  overall_completion: number;
  total_time_spent: number;
  modules: ModuleProgress[];
}

/**
 * Workflow states that count as "done" for progress and certification.
 * Kept in parity with the database, which is the authority on completion:
 * check_course_completion() and auto_issue_certificate_on_progression() both
 * accept 'read' or 'completed'. 'graded' is a post-completion state for
 * assignments and counts as done too.
 */
export const DONE_PROGRESSION_STATES = ['read', 'completed', 'graded'] as const;

export function isProgressionDone(workflowState?: string | null): boolean {
  return !!workflowState && (DONE_PROGRESSION_STATES as readonly string[]).includes(workflowState);
}

export function useProgressTracking(courseId?: string, moduleId?: string) {
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress | null>(null);
  const [contentProgress, setContentProgress] = useState<ContentProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      if (courseId) {
        fetchCourseProgress();
      } else if (moduleId) {
        fetchModuleProgress();
      }
    }
  }, [user, courseId, moduleId]);

  const fetchCourseProgress = async () => {
    if (!courseId || !user) return;

    try {
      setLoading(true);
      setError(null);

      // Get course info
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('id, title')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      if (!course) throw new Error('Course not found');

      // Scope to published modules and published items, and treat the same
      // workflow states as done that the database does. The DB is the authority
      // here: check_course_completion() and the auto_issue_certificate_on_progression
      // trigger both count 'read' or 'completed' rows against published items only.
      // This hook used to count every content_item on the course (published or
      // not) and ignore 'read', so a student whose course the trigger had
      // already certified saw "Your certificate is ready" above a card reading
      // "Complete the course to unlock certification" at 85%.
      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('id, title, week')
        .eq('course_id', courseId)
        .eq('published', true)
        .order('week');

      if (modulesError) throw modulesError;

      const moduleIds = modules?.map(m => m.id) || [];

      // Get published content items belonging to those modules
      const { data: contentItems, error: contentItemsError } = await supabase
        .from('content_items')
        .select('id, module_id')
        .in('module_id', moduleIds)
        .eq('published', true);

      if (contentItemsError) throw contentItemsError;

      const contentItemIds = contentItems?.map(item => item.id) || [];

      // Get user's progress using content_item_progressions
      const { data: progressData, error: progressError } = await supabase
        .from('content_item_progressions')
        .select('*')
        .eq('user_id', user.id)
        .in('content_item_id', contentItemIds);

      if (progressError) throw progressError;

      // Calculate module progress
      const moduleProgress: ModuleProgress[] = modules?.map(module => {
        const moduleItems = contentItems?.filter(item => item.module_id === module.id) || [];
        const moduleProgressData = progressData?.filter(p => 
          moduleItems.some(item => item.id === p.content_item_id)
        ) || [];
        
        const completedItems = moduleProgressData.filter(p =>
          isProgressionDone(p.workflow_state)
        ).length;

        const totalTimeSpent = 0; // Not tracked in content_item_progressions yet
        const lastAccessed = moduleProgressData.reduce((latest, p) => 
          !latest || new Date(p.updated_at) > new Date(latest) 
            ? p.updated_at 
            : latest
        , '');

        return {
          module_id: module.id,
          module_title: module.title,
          total_blocks: moduleItems.length,
          completed_blocks: completedItems,
          completion_percentage: moduleItems.length > 0 
            ? Math.round((completedItems / moduleItems.length) * 100) 
            : 0,
          time_spent: totalTimeSpent,
          last_accessed: lastAccessed
        };
      }) || [];

      // Calculate overall course progress
      const totalBlocks = moduleProgress.reduce((sum, m) => sum + m.total_blocks, 0);
      const totalCompleted = moduleProgress.reduce((sum, m) => sum + m.completed_blocks, 0);
      const totalTimeSpent = moduleProgress.reduce((sum, m) => sum + m.time_spent, 0);
      const completedModules = moduleProgress.filter(m => m.completion_percentage === 100).length;

      setCourseProgress({
        course_id: courseId,
        course_title: course.title,
        total_modules: modules?.length || 0,
        completed_modules: completedModules,
        overall_completion: totalBlocks > 0 ? Math.round((totalCompleted / totalBlocks) * 100) : 0,
        total_time_spent: totalTimeSpent,
        modules: moduleProgress
      });

    } catch (error: any) {
      logger.error('Error fetching course progress:', error);
      // Do NOT synthesize a zeroed progress object — a failed fetch must not
      // present 0% progress as real data.
      setCourseProgress(null);
      setError(error?.message || 'Failed to load course progress');
      toast({
        title: 'Error',
        description: 'Failed to load course progress',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchModuleProgress = async () => {
    if (!moduleId || !user) return;

    try {
      setLoading(true);
      setError(null);

      // Get module info
      const { data: module, error: moduleError } = await supabase
        .from('modules')
        .select('id, title')
        .eq('id', moduleId)
        .single();

      if (moduleError) throw moduleError;
      if (!module) throw new Error('Module not found');

      // Get content items for this module
      const { data: contentItems, error: contentItemsError } = await supabase
        .from('content_items')
        .select('id, title')
        .eq('module_id', moduleId)
        .eq('published', true);

      if (contentItemsError) throw contentItemsError;

      const contentItemIds = contentItems?.map(item => item.id) || [];

      // Get user's progress using content_item_progressions
      const { data: progressData, error: progressError } = await supabase
        .from('content_item_progressions')
        .select('*')
        .eq('user_id', user.id)
        .in('content_item_id', contentItemIds);

      if (progressError) throw progressError;

      // Map to legacy format for compatibility
      const legacyProgress = progressData?.map(p => ({
        id: p.id,
        user_id: p.user_id,
        content_block_id: p.content_item_id,
        completed: isProgressionDone(p.workflow_state),
        completion_percentage: isProgressionDone(p.workflow_state) ? 100 : 0,
        time_spent: 0,
        last_accessed_at: p.updated_at,
        completed_at: p.workflow_state === 'completed' ? p.updated_at : undefined
      })) || [];

      setContentProgress(legacyProgress as any);

      const completedItems = progressData?.filter(p =>
        isProgressionDone(p.workflow_state)
      ).length || 0;
      const totalTimeSpent = 0;
      const lastAccessed = progressData?.reduce((latest, p) => 
        !latest || new Date(p.updated_at) > new Date(latest) 
          ? p.updated_at 
          : latest
      , '') || '';

      setModuleProgress({
        module_id: moduleId,
        module_title: module.title,
        total_blocks: contentItems?.length || 0,
        completed_blocks: completedItems,
        completion_percentage: contentItems?.length 
          ? Math.round((completedItems / contentItems.length) * 100) 
          : 0,
        time_spent: totalTimeSpent,
        last_accessed: lastAccessed
      });

    } catch (error: any) {
      logger.error('Error fetching module progress:', error);
      // Do NOT synthesize a zeroed progress object — a failed fetch must not
      // present 0% progress as real data.
      setModuleProgress(null);
      setError(error?.message || 'Failed to load module progress');
      toast({
        title: 'Error',
        description: 'Failed to load module progress',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateContentProgress = async (
    contentItemId: string, 
    completed: boolean, 
    completionPercentage: number = 0,
    timeSpent: number = 0
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const workflowState = completed ? 'completed' : 'unread';

      const { error } = await supabase
        .from('content_item_progressions')
        .upsert({
          user_id: user.id,
          content_item_id: contentItemId,
          workflow_state: workflowState
        }, { 
          onConflict: 'user_id,content_item_id' 
        });

      if (error) throw error;

      // Update local state (mapped to legacy format)
      setContentProgress(prev => {
        const existing = prev.find(p => p.content_block_id === contentItemId);
        const updatedItem = {
          id: existing?.id || crypto.randomUUID(),
          user_id: user.id,
          content_block_id: contentItemId,
          completed,
          completion_percentage: completionPercentage,
          time_spent: timeSpent,
          last_accessed_at: new Date().toISOString(),
          ...(completed && { completed_at: new Date().toISOString() })
        } as ContentProgress;

        if (existing) {
          return prev.map(p => 
            p.content_block_id === contentItemId ? updatedItem : p
          );
        } else {
          return [...prev, updatedItem];
        }
      });

      // Refresh progress data
      if (courseId) {
        fetchCourseProgress();
      } else if (moduleId) {
        fetchModuleProgress();
      }

      return true;
    } catch (error) {
      logger.error('Error updating content progress:', error);
      toast({
        title: 'Error',
        description: 'Failed to update progress',
        variant: 'destructive'
      });
      return false;
    }
  };

  const getContentProgress = (contentBlockId: string): ContentProgress | null => {
    return contentProgress.find(p => p.content_block_id === contentBlockId) || null;
  };

  const markContentComplete = async (contentBlockId: string, timeSpent: number = 0) => {
    return updateContentProgress(contentBlockId, true, 100, timeSpent);
  };

  const markContentIncomplete = async (contentBlockId: string) => {
    return updateContentProgress(contentBlockId, false, 0);
  };

  const addTimeSpent = async (contentBlockId: string, additionalTime: number) => {
    const existing = getContentProgress(contentBlockId);
    const newTimeSpent = (existing?.time_spent || 0) + additionalTime;
    const completed = existing?.completed || false;
    const completionPercentage = existing?.completion_percentage || 0;
    
    return updateContentProgress(contentBlockId, completed, completionPercentage, newTimeSpent);
  };

  return {
    courseProgress,
    moduleProgress,
    contentProgress,
    loading,
    error,
    updateContentProgress,
    getContentProgress,
    markContentComplete,
    markContentIncomplete,
    addTimeSpent,
    refetch: courseId ? fetchCourseProgress : fetchModuleProgress
  };
}