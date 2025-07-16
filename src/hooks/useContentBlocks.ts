
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isValidUUID } from '@/utils/idUtils';
import { ContentBlock, ContentBlockInput } from '@/types/moduleContent';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useContentBlocks');

export type { ContentBlock, ContentBlockInput };

export function useContentBlocks(moduleId?: string, lessonId?: string) {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
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

    if (lessonId && !isValidUUID(lessonId)) {
      logger.error(`Invalid lesson UUID format: ${lessonId}`);
      setError('Invalid lesson ID format');
      setLoading(false);
      return;
    }

    fetchContentBlocks();
  }, [moduleId, lessonId]);

  const fetchContentBlocks = async () => {
    if (!moduleId) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('content_blocks')
        .select('*')
        .eq('module_id', moduleId);

      // Filter by lesson_id if provided, or show only module-level content if no lesson selected
      if (lessonId) {
        query = query.eq('lesson_id', lessonId);
      } else {
        query = query.is('lesson_id', null);
      }

      const { data, error } = await query.order('position', { ascending: true });

      if (error) throw error;
      setBlocks(data || []);
    } catch (error: any) {
      logger.error('Error fetching content blocks:', error);
      setError(error.message || 'Failed to load content blocks');
      toast({
        title: 'Error',
        description: 'Failed to load content blocks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addBlock = async (blockData: ContentBlockInput): Promise<ContentBlock | null> => {
    if (!user || !moduleId) return null;

    if (!isValidUUID(moduleId)) {
      logger.error(`Invalid module UUID format: ${moduleId}`);
      toast({
        title: 'Error',
        description: 'Invalid module ID format',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('content_blocks')
        .insert({
          ...blockData,
          module_id: moduleId,
          lesson_id: lessonId || null,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setBlocks(prev => [...prev, data]);
      
      toast({
        title: 'Success',
        description: 'Content block added successfully',
      });

      return data;
    } catch (error: any) {
      logger.error('Error adding content block:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add content block',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateBlock = async (id: string, updates: Partial<ContentBlockInput>): Promise<ContentBlock | null> => {
    if (!isValidUUID(id)) {
      logger.error(`Invalid block UUID format: ${id}`);
      toast({
        title: 'Error',
        description: 'Invalid block ID format',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('content_blocks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setBlocks(prev => prev.map(block => block.id === id ? data : block));
      
      toast({
        title: 'Success',
        description: 'Content block updated successfully',
      });

      return data;
    } catch (error: any) {
      logger.error('Error updating content block:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update content block',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteBlock = async (id: string): Promise<boolean> => {
    if (!isValidUUID(id)) {
      logger.error(`Invalid block UUID format: ${id}`);
      toast({
        title: 'Error',
        description: 'Invalid block ID format',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('content_blocks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setBlocks(prev => prev.filter(block => block.id !== id));
      
      toast({
        title: 'Success',
        description: 'Content block deleted successfully',
      });

      return true;
    } catch (error: any) {
      logger.error('Error deleting content block:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete content block',
        variant: 'destructive',
      });
      return false;
    }
  };

  const reorderBlocks = async (reorderedBlocks: ContentBlock[]): Promise<boolean> => {
    try {
      // Update positions in the database
      const updates = reorderedBlocks.map((block, index) => ({
        id: block.id,
        position: index
      }));

      for (const update of updates) {
        if (!isValidUUID(update.id)) {
          logger.error(`Invalid block UUID format: ${update.id}`);
          continue;
        }

        const { error } = await supabase
          .from('content_blocks')
          .update({ position: update.position })
          .eq('id', update.id);

        if (error) throw error;
      }

      setBlocks(reorderedBlocks);
      
      toast({
        title: 'Success',
        description: 'Content blocks reordered successfully',
      });

      return true;
    } catch (error: any) {
      logger.error('Error reordering content blocks:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reorder content blocks',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    blocks,
    loading,
    error,
    addBlock,
    updateBlock,
    deleteBlock,
    reorderBlocks,
    refetch: fetchContentBlocks
  };
}
