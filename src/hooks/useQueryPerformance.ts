
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useQueryPerformance() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Monitor query cache size and performance
    const interval = setInterval(() => {
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();
      
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[React Query] Active queries: ${queries.length}`);
        
        // Log stale queries
        const staleQueries = queries.filter(query => query.isStale());
        if (staleQueries.length > 0) {
          console.log(`[React Query] Stale queries: ${staleQueries.length}`);
        }
        
        // Log error queries
        const errorQueries = queries.filter(query => query.state.status === 'error');
        if (errorQueries.length > 0) {
          console.warn(`[React Query] Error queries: ${errorQueries.length}`);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [queryClient]);

  return {
    invalidateAll: () => queryClient.invalidateQueries(),
    clearCache: () => queryClient.clear(),
    prefetchQuery: queryClient.prefetchQuery.bind(queryClient),
  };
}
