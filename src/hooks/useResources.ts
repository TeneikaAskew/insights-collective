
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Resource {
  id: string;
  category: string;
  deadline: string | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  
  // Resource fields
  resource_type: string | null;
  resource_link: string | null;
  career_area: string | null;
  predicted_resource_labels: string | null;
  predicted_career_labels: string | null;
  source: string | null;
  
  // Twitter specific fields
  tweet_id: string | null;
  full_text: string | null;
  tweet_likes: number | null;
  tweet_retweets: number | null;
  favorite_count: number | null;
  retweet_count: number | null;
  
  // Other metadata fields
  user_mentions: any | null;
  in_reply_to_screen_name: string | null;
  lang: string | null;
  created_at_est: string | null;
}

// Helper to parse string arrays that might be in JSON string format or comma-separated
export const parseArrayField = (field: string | null | undefined): string[] => {
  if (!field) return [];

  let cleanedField = String(field).trim();

  // Handle JSON-like arrays: ['value1','value2'] or ["value1","value2"]
  if (cleanedField.startsWith('[') && cleanedField.endsWith(']')) {
    try {
      const jsonStr = cleanedField.replace(/'/g, '"');
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(Boolean);
      }
    } catch (e) {
      cleanedField = cleanedField.substring(1, cleanedField.length - 1);
    }
  }
  
  if (cleanedField.startsWith('(') && cleanedField.endsWith(')')) {
    cleanedField = cleanedField.substring(1, cleanedField.length - 1);
  }

  return cleanedField
    .split(',')
    .map(item => item.replace(/['"]/g, '').trim()) 
    .filter(Boolean);
};

export const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .split(/[\s_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/^['"]+|['"]+$/g, '');
};

// Enhanced query keys for better cache management
export const resourcesKeys = {
  all: ['resources'] as const,
  lists: () => [...resourcesKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...resourcesKeys.lists(), filters] as const,
  details: () => [...resourcesKeys.all, 'detail'] as const,
  detail: (id: string) => [...resourcesKeys.details(), id] as const,
};

export function useResources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const fetchResources = async (): Promise<Resource[]> => {
    console.log('Fetching resources from API');
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

  const { data: resources, isLoading, error, isError } = useQuery({
    queryKey: resourcesKeys.lists(),
    queryFn: fetchResources,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Set up realtime subscription for updates with optimistic updates
  useEffect(() => {
    const channel = supabase
      .channel('resources_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resources' },
        (payload) => {
          console.log('Resources change received:', payload);
          
          // Invalidate and refetch the resources query
          queryClient.invalidateQueries({ queryKey: resourcesKeys.all });
          
          // Show toast for real-time updates
          if (payload.eventType === 'INSERT') {
            toast({
              title: 'New resource added',
              description: 'Fresh content is now available!',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);

  return {
    resources: resources || [],
    isLoading,
    error,
    isError,
  };
}
