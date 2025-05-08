
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast'; // Updated import
import type { Resource } from './useResources'; // Import type

export function useAllTweetsData() {
  const { toast } = useToast();

  const fetchAllTweets = async (): Promise<Resource[]> => {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      // Fetches resources that are likely tweets based on source, link, or if they have a tweet_id
      .or('source.ilike.%twitter%,resource_link.ilike.%twitter.com%,tweet_id.not.is.null') // Corrected here
      .order('created_at', { ascending: false }); // Base ordering, specific "top" sorting happens client-side

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
  });
}
