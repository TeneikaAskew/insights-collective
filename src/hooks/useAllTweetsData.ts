
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast'; 
import type { Resource } from './useResources';

// Enhanced query keys for better cache management
export const tweetsKeys = {
  all: ['tweets'] as const,
  lists: () => [...tweetsKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...tweetsKeys.lists(), filters] as const,
};

export function useAllTweetsData() {
  const { toast } = useToast();

  const fetchAllTweets = async (): Promise<Resource[]> => {
    console.log('Fetching all tweets data from API');
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .or('source.ilike.%twitter%,resource_link.ilike.%twitter.com%,tweet_id.not.is.null') 
      .order('created_at', { ascending: false }); 

    if (error) {
      console.error('Error fetching all tweets:', error);
      toast({
        title: 'Error fetching tweet data',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
    return data || [];
  };

  return useQuery({
    queryKey: tweetsKeys.lists(),
    queryFn: fetchAllTweets,
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
}
