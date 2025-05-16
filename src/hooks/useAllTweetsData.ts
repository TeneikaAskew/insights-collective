
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast'; 
import type { Resource } from './useResources'; // Import type

// Constants for caching
const TWEETS_CACHE_TIME = 1000 * 60 * 30; // 30 minutes
const TWEETS_STALE_TIME = 1000 * 60 * 5; // 5 minutes

export function useAllTweetsData() {
  const { toast } = useToast();

  const fetchAllTweets = async (): Promise<Resource[]> => {
    console.log('Fetching all tweets data from API');
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      // Fetches resources that are likely tweets based on source, link, or if they have a tweet_id
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

  return useQuery<Resource[], Error>({
    queryKey: ['allTweetsData'],
    queryFn: fetchAllTweets,
    staleTime: TWEETS_STALE_TIME, // Data will be considered fresh for 5 minutes
    cacheTime: TWEETS_CACHE_TIME, // Cached data will be kept for 30 minutes
    refetchOnWindowFocus: false, // Prevent refetching when window gains focus
  });
}
