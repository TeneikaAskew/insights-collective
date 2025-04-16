
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useModuleContent = (moduleId: string) => {
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!moduleId) return;

    const fetchModuleContents = async () => {
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
        console.error('Error fetching module contents:', error);
        setError(error.message || 'Failed to load module contents');
      } finally {
        setLoading(false);
      }
    };
    
    fetchModuleContents();
  }, [moduleId]);

  const updateContent = async (contentId: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('module_content')
        .update(updates)
        .eq('id', contentId)
        .select()
        .single();
      
      if (error) throw error;
      
      setContents(contents.map(content => 
        content.id === contentId ? data : content
      ));
      
      return data;
    } catch (error: any) {
      console.error('Error updating content:', error);
      setError(error.message || 'Failed to update content');
      return null;
    }
  };

  return {
    contents,
    loading,
    error,
    updateContent
  };
};
