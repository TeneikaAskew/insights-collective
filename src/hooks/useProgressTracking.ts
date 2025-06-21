import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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

export function useProgressTracking(courseId?: string, moduleId?: string) {
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress | null>(null);
  const [contentProgress, setContentProgress] = useState<ContentProgress[]>([]);
  const [loading, setLoading] = useState(true);
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

      // Get course info
      const { data: course } = await supabase
        .from('courses')
        .select('id, title')
        .eq('id', courseId)
        .single();

      if (!course) throw new Error('Course not found');

      // Get modules with their content blocks
      const { data: modules } = await supabase
        .from('modules')
        .select(`
          id, title, week,
          content_blocks(id, completion_required)
        `)
        .eq('course_id', courseId)
        .order('week');

      // Get user's progress for all content blocks in this course
      const contentBlockIds = modules?.flatMap(m => 
        m.content_blocks?.map(cb => cb.id) || []
      ) || [];

      const { data: progressData } = await supabase
        .from('content_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('content_block_id', contentBlockIds);

      // Calculate module progress
      const moduleProgress: ModuleProgress[] = modules?.map(module => {
        const moduleBlocks = module.content_blocks || [];
        const moduleProgressData = progressData?.filter(p => 
          moduleBlocks.some(cb => cb.id === p.content_block_id)
        ) || [];
        
        const completedBlocks = moduleProgressData.filter(p => p.completed).length;
        const totalTimeSpent = moduleProgressData.reduce((sum, p) => sum + p.time_spent, 0);
        const lastAccessed = moduleProgressData.reduce((latest, p) => 
          !latest || new Date(p.last_accessed_at) > new Date(latest) 
            ? p.last_accessed_at 
            : latest
        , '');

        return {
          module_id: module.id,
          module_title: module.title,
          total_blocks: moduleBlocks.length,
          completed_blocks: completedBlocks,
          completion_percentage: moduleBlocks.length > 0 
            ? Math.round((completedBlocks / moduleBlocks.length) * 100) 
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

    } catch (error) {
      console.error('Error fetching course progress:', error);
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

      // Get module info with content blocks
      const { data: module } = await supabase
        .from('modules')
        .select(`
          id, title,
          content_blocks(id, title, completion_required)
        `)
        .eq('id', moduleId)
        .single();

      if (!module) throw new Error('Module not found');

      // Get user's progress for this module's content blocks
      const contentBlockIds = module.content_blocks?.map(cb => cb.id) || [];
      
      const { data: progressData } = await supabase
        .from('content_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('content_block_id', contentBlockIds);

      setContentProgress(progressData || []);

      const completedBlocks = progressData?.filter(p => p.completed).length || 0;
      const totalTimeSpent = progressData?.reduce((sum, p) => sum + p.time_spent, 0) || 0;
      const lastAccessed = progressData?.reduce((latest, p) => 
        !latest || new Date(p.last_accessed_at) > new Date(latest) 
          ? p.last_accessed_at 
          : latest
      , '') || '';

      setModuleProgress({
        module_id: moduleId,
        module_title: module.title,
        total_blocks: module.content_blocks?.length || 0,
        completed_blocks: completedBlocks,
        completion_percentage: module.content_blocks?.length 
          ? Math.round((completedBlocks / module.content_blocks.length) * 100) 
          : 0,
        time_spent: totalTimeSpent,
        last_accessed: lastAccessed
      });

    } catch (error) {
      console.error('Error fetching module progress:', error);
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
    contentBlockId: string, 
    completed: boolean, 
    completionPercentage: number = 0,
    timeSpent: number = 0
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const updateData = {
        user_id: user.id,
        content_block_id: contentBlockId,
        completed,
        completion_percentage: completionPercentage,
        time_spent: timeSpent,
        last_accessed_at: new Date().toISOString(),
        ...(completed && { completed_at: new Date().toISOString() })
      };

      const { error } = await supabase
        .from('content_progress')
        .upsert(updateData, { 
          onConflict: 'user_id,content_block_id' 
        });

      if (error) throw error;

      // Update local state
      setContentProgress(prev => {
        const existing = prev.find(p => p.content_block_id === contentBlockId);
        if (existing) {
          return prev.map(p => 
            p.content_block_id === contentBlockId 
              ? { ...p, ...updateData } 
              : p
          );
        } else {
          return [...prev, { 
            id: crypto.randomUUID(), // Temporary ID
            ...updateData 
          } as ContentProgress];
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
      console.error('Error updating content progress:', error);
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
    updateContentProgress,
    getContentProgress,
    markContentComplete,
    markContentIncomplete,
    addTimeSpent,
    refetch: courseId ? fetchCourseProgress : fetchModuleProgress
  };
}