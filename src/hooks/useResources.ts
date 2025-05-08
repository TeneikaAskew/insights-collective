
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
  
  // New fields based on the updated schema
  resource_type: string | null;
  resource_link: string | null;
  career_area: string | null;
  predicted_resource_labels: string | null;
  predicted_career_labels: string | null;
  
  // Twitter specific fields
  tweet_url: string | null;
  tweet_id: string | null;
  full_text: string | null;
  tweet_likes: number | null;
  tweet_retweets: number | null;
  favorite_count: number | null;
  retweet_count: number | null;
  
  // LinkedIn specific fields
  linkedin_url: string | null;
  
  // Other metadata fields
  user_mentions: any | null;
  in_reply_to_screen_name: string | null;
  source: string | null;
  lang: string | null;
  created_at_est: string | null;
}

// Helper to parse string arrays that might be in JSON string format
export const parseArrayField = (field: string | null | undefined): string[] => {
  if (!field) return [];
  
  // If it's already an array in string format like "['item1', 'item2']"
  if (field.startsWith('[') && field.endsWith(']')) {
    try {
      // Convert the string representation to actual array
      // Replace single quotes with double quotes for valid JSON
      const jsonStr = field.replace(/'/g, '"');
      const parsed = JSON.parse(jsonStr);
      
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item && typeof item === 'string');
      }
    } catch (e) {
      // If parsing fails, split by comma as fallback
      return field
        .replace(/[\[\]']/g, '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }
  }
  
  // If it's a simple string, just return it as a one-item array
  return field ? [field] : [];
};

// Helper to normalize text for display
export const normalizeString = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/^'|'$/g, ''); // Remove surrounding quotes if present
};

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
