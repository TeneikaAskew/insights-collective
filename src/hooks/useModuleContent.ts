
import { useState, useEffect } from 'react';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

type ModuleContent = {
  id: string;
  module_id: string;
  type: 'text' | 'video' | 'image';
  content: string;
  position: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

export function useModuleContent(moduleId?: string) {
  const [contents, setContents] = useState<ModuleContent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    if (!moduleId) return;
    
    const fetchModuleContent = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('module_content')
          .select('*')
          .eq('module_id', moduleId)
          .order('position', { ascending: true });
        
        if (error) throw error;
        setContents(data || []);
      } catch (error: any) {
        console.error('Error fetching module content:', error);
        toast({
          title: 'Error',
          description: 'Failed to load module content',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchModuleContent();
  }, [moduleId, toast]);
  
  const addContent = async (newContent: Omit<ModuleContent, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('module_content')
        .insert(newContent)
        .select()
        .single();
      
      if (error) throw error;
      
      setContents(prev => [...prev, data]);
      
      toast({
        title: 'Success',
        description: 'Content added successfully',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error adding content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add content',
        variant: 'destructive',
      });
      return null;
    }
  };
  
  const updateContent = async (id: string, updates: Partial<Omit<ModuleContent, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('module_content')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      setContents(prev => prev.map(c => c.id === id ? data : c));
      
      toast({
        title: 'Success',
        description: 'Content updated successfully',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error updating content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update content',
        variant: 'destructive',
      });
      return null;
    }
  };
  
  const deleteContent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('module_content')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setContents(prev => prev.filter(c => c.id !== id));
      
      toast({
        title: 'Success',
        description: 'Content deleted successfully',
      });
      
      return true;
    } catch (error: any) {
      console.error('Error deleting content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete content',
        variant: 'destructive',
      });
      return false;
    }
  };
  
  const reorderContent = async (newOrder: ModuleContent[]) => {
    try {
      // Update positions in the database
      const updates = newOrder.map((content, index) => ({
        id: content.id,
        position: index
      }));
      
      const { error } = await supabase.rpc('update_module_content_positions', { updates });
      
      if (error) {
        // Fallback to individual updates if RPC is not available
        for (const content of newOrder) {
          await supabase
            .from('module_content')
            .update({ position: newOrder.findIndex(c => c.id === content.id) })
            .eq('id', content.id);
        }
      }
      
      // Update local state
      setContents([...newOrder]);
      
      toast({
        title: 'Success',
        description: 'Content reordered successfully',
      });
      
      return true;
    } catch (error: any) {
      console.error('Error reordering content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reorder content',
        variant: 'destructive',
      });
      return false;
    }
  };
  
  return {
    contents,
    loading,
    addContent,
    updateContent,
    deleteContent,
    reorderContent
  };
}
