// ABOUTME: Hook for managing lessons within modules, including CRUD operations
// ABOUTME: Provides lesson data, loading states, and functions for lesson management

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isValidUUID } from '@/utils/idUtils';

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string;
  order_num: number;
  content: string;
  duration?: string;
  estimated_duration?: number;
  content_blocks_count?: number;
  completion_required: boolean;
  completion_criteria: Record<string, any>;
  created_at: string;
  updated_at: string;
}

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
      console.error(`Invalid module UUID format: ${moduleId}`);
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
      setLessons(data || []);
    } catch (error: any) {
      console.error('Error fetching lessons:', error);
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

  const addLesson = async (lessonData: Omit<Lesson, 'id' | 'created_at' | 'updated_at'>): Promise<Lesson | null> => {
    if (!user || !moduleId) return null;

    if (!isValidUUID(moduleId)) {
      console.error(`Invalid module UUID format: ${moduleId}`);
      toast({
        title: 'Error',
        description: 'Invalid module ID format',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('lessons')
        .insert({
          ...lessonData,
          module_id: moduleId
        })
        .select()
        .single();

      if (error) throw error;

      setLessons(prev => [...prev, data]);
      
      toast({
        title: 'Success',
        description: 'Lesson added successfully',
      });

      return data;
    } catch (error: any) {
      console.error('Error adding lesson:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add lesson',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateLesson = async (id: string, updates: Partial<Omit<Lesson, 'id' | 'created_at' | 'updated_at'>>): Promise<Lesson | null> => {
    if (!isValidUUID(id)) {
      console.error(`Invalid lesson UUID format: ${id}`);
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

      setLessons(prev => prev.map(lesson => lesson.id === id ? data : lesson));
      
      toast({
        title: 'Success',
        description: 'Lesson updated successfully',
      });

      return data;
    } catch (error: any) {
      console.error('Error updating lesson:', error);
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
      console.error(`Invalid lesson UUID format: ${id}`);
      toast({
        title: 'Error',
        description: 'Invalid lesson ID format',
        variant: 'destructive',
      });
      return false;
    }

    try {
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
      console.error('Error deleting lesson:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete lesson',
        variant: 'destructive',
      });
      return false;
    }
  };

  const reorderLessons = async (reorderedLessons: Lesson[]): Promise<boolean> => {
    try {
      const updates = reorderedLessons.map((lesson, index) => ({
        id: lesson.id,
        order_num: index + 1
      }));

      for (const update of updates) {
        if (!isValidUUID(update.id)) {
          console.error(`Invalid lesson UUID format: ${update.id}`);
          continue;
        }

        const { error } = await supabase
          .from('lessons')
          .update({ order_num: update.order_num })
          .eq('id', update.id);

        if (error) throw error;
      }

      setLessons(reorderedLessons);
      
      toast({
        title: 'Success',
        description: 'Lessons reordered successfully',
      });

      return true;
    } catch (error: any) {
      console.error('Error reordering lessons:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reorder lessons',
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
    reorderLessons,
    refetch: fetchLessons
  };
}