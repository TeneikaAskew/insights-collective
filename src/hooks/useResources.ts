
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  let cleanedField = String(field).trim(); // Ensure field is treated as a string

  // Handle JSON-like arrays: ['value1','value2'] or ["value1","value2"]
  if (cleanedField.startsWith('[') && cleanedField.endsWith(']')) {
    try {
      const jsonStr = cleanedField.replace(/'/g, '"'); // Ensure double quotes for valid JSON
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(Boolean);
      }
    } catch (e) {
      // Fallback for malformed JSON-like strings: remove brackets and split
      cleanedField = cleanedField.substring(1, cleanedField.length - 1);
    }
  }
  
  // Handle tuple-like strings: (value1, value2) by removing parentheses
  if (cleanedField.startsWith('(') && cleanedField.endsWith(')')) {
    cleanedField = cleanedField.substring(1, cleanedField.length - 1);
  }

  // Split by comma for remaining cases (e.g., "value1,value2" or after bracket/parentheses removal)
  // Also remove any remaining single or double quotes from individual items
  return cleanedField
    .split(',')
    .map(item => item.replace(/['"]/g, '').trim()) 
    .filter(Boolean);
};

// Helper to normalize text for display
export const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return String(str) // Ensure str is treated as a string
    .toLowerCase()
    .split(/[\s_]+/) // Split by space or underscore
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/^['"]+|['"]+$/g, ''); // Remove surrounding single or double quotes
};

// Constants for caching
const RESOURCES_GC_TIME = 1000 * 60 * 30; // 30 minutes
const RESOURCES_STALE_TIME = 1000 * 60 * 5; // 5 minutes

export function useResources() {
  const { toast } = useToast();
  
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

  // Use React Query with caching configuration
  const { data: resources, isLoading, error } = useQuery<Resource[], Error>({
    queryKey: ['resources'],
    queryFn: fetchResources,
    staleTime: RESOURCES_STALE_TIME, // Data will be considered fresh for 5 minutes
    gcTime: RESOURCES_GC_TIME, // Cached data will be kept for 30 minutes (renamed from cacheTime)
    refetchOnWindowFocus: false, // Prevent refetching when window gains focus
  });

  // Set up realtime subscription for updates
  useEffect(() => {
    const channel = supabase
      .channel('resources_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resources' },
        (payload) => {
          console.log('Resources change received:', payload);
          // Invalidate and refetch
          window.location.reload(); // Consider queryClient.invalidateQueries(['resources']) for a smoother update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // queryClient should be a dependency if used for invalidation

  return {
    resources: resources || [],
    isLoading,
    error,
  };
}
