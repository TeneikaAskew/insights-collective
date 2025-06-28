
import { useState, useEffect } from 'react';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
import { isValidUUID } from '@/utils/idUtils';
import { ModuleContent, ModuleContentInput } from '@/types/moduleContent';

export function useModuleContent(moduleId?: string) {
  const [contents, setContents] = useState<ModuleContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    if (!moduleId) {
      setLoading(false);
      return;
    }
    
    // Validate UUID format
    if (!isValidUUID(moduleId)) {
      console.error(`Invalid module UUID format: ${moduleId}`);
      setError('Invalid module ID format');
      setLoading(false);
      return;
    }
    
    const fetchModuleContent = async () => {
      setLoading(true);
      setError(null);
      
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
        setError(error.message || 'Failed to load module content');
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
  
  const addContent = async (newContent: ModuleContentInput) => {
    // Validate module_id UUID format
    if (!newContent.module_id || !isValidUUID(newContent.module_id)) {
      console.error(`Invalid module UUID format: ${newContent.module_id}`);
      toast({
        title: 'Error',
        description: 'Invalid module ID format',
        variant: 'destructive',
      });
      return null;
    }
    
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
  
  const updateContent = async (id: string, updates: Partial<ModuleContentInput>) => {
    // Validate content id UUID format
    if (!id || !isValidUUID(id)) {
      console.error(`Invalid content UUID format: ${id}`);
      toast({
        title: 'Error',
        description: 'Invalid content ID format',
        variant: 'destructive',
      });
      return null;
    }
    
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
    // Validate content id UUID format
    if (!id || !isValidUUID(id)) {
      console.error(`Invalid content UUID format: ${id}`);
      toast({
        title: 'Error',
        description: 'Invalid content ID format',
        variant: 'destructive',
      });
      return false;
    }
    
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
      // Ensure all items have valid UUIDs
      if (newOrder.some(item => !isValidUUID(item.id))) {
        console.error('Invalid content UUID format in reordering');
        toast({
          title: 'Error',
          description: 'Invalid content ID format',
          variant: 'destructive',
        });
        return false;
      }
      
      // Update positions in the database
      const updates = newOrder.map((content, index) => ({
        id: content.id,
        position: index
      }));
      
      // Update each item individually since the RPC might not be available
      for (const content of newOrder) {
        const { error } = await supabase
          .from('module_content')
          .update({ position: newOrder.findIndex(c => c.id === content.id) })
          .eq('id', content.id);
          
        if (error) throw error;
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
    error,
    addContent,
    updateContent,
    deleteContent,
    reorderContent
  };
}
