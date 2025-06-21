
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isValidUUID } from '@/utils/idUtils';

export interface ContentBlock {
  id: string;
  module_id: string;
  lesson_id?: string;
  block_type: string;
  title?: string;
  content: string;
  metadata: Record<string, any>;
  file_url?: string;
  file_type?: string;
  file_size?: number;
  position: number;
  is_interactive: boolean;
  completion_required: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useContentBlocks(moduleId?: string, lessonId?: string) {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // Fetch blocks based on lesson or module
    if (lessonId || moduleId) {
      fetchContentBlocks();
    } else {
      setLoading(false);
    }
  }, [moduleId, lessonId]);

  const fetchContentBlocks = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase.from('content_blocks').select('*');
      
      if (lessonId && isValidUUID(lessonId)) {
        query = query.eq('lesson_id', lessonId);
      } else if (moduleId && isValidUUID(moduleId)) {
        query = query.eq('module_id', moduleId);
      } else {
        throw new Error('Invalid module or lesson ID format');
      }

      const { data, error } = await query.order('position', { ascending: true });

      if (error) throw error;
      setBlocks(data || []);
    } catch (error: any) {
      console.error('Error fetching content blocks:', error);
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

  const addBlock = async (blockData: Omit<ContentBlock, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<ContentBlock | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('content_blocks')
        .insert({
          ...blockData,
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
      console.error('Error adding content block:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add content block',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateBlock = async (id: string, updates: Partial<Omit<ContentBlock, 'id' | 'created_at' | 'updated_at' | 'created_by'>>): Promise<ContentBlock | null> => {
    if (!isValidUUID(id)) {
      console.error(`Invalid block UUID format: ${id}`);
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
      console.error('Error updating content block:', error);
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
      console.error(`Invalid block UUID format: ${id}`);
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
      console.error('Error deleting content block:', error);
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
      const updates = reorderedBlocks.map((block, index) => ({
        id: block.id,
        position: index
      }));

      for (const update of updates) {
        if (!isValidUUID(update.id)) {
          console.error(`Invalid block UUID format: ${update.id}`);
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
      console.error('Error reordering content blocks:', error);
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
