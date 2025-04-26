
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Resource {
  id: string;
  name: string;
  description: string;
  category: string;
  link: string;
  deadline: string | null;
  created_at: string;
  created_by: string;
}

export function useResources() {
  const { toast } = useToast();
  
  const fetchResources = async () => {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching resources:', error);
      toast({
        title: 'Error fetching resources',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
    
    return data || [];
  };

  const { data: resources, isLoading, error } = useQuery({
    queryKey: ['resources'],
    queryFn: fetchResources,
  });

  useEffect(() => {
    const channel = supabase
      .channel('resources_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resources' },
        (payload) => {
          console.log('Resources change received:', payload);
          // Invalidate and refetch
          window.location.reload();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    resources: resources || [],
    isLoading,
    error,
  };
}
