
import { QueryClient } from '@tanstack/react-query';
import { resourcesKeys } from '@/hooks/useResources';
import { tweetsKeys } from '@/hooks/useAllTweetsData';

export class RoutePreloader {
  private static instance: RoutePreloader;
  private queryClient: QueryClient;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  static getInstance(queryClient: QueryClient): RoutePreloader {
    if (!RoutePreloader.instance) {
      RoutePreloader.instance = new RoutePreloader(queryClient);
    }
    return RoutePreloader.instance;
  }

  // Preload data for specific routes
  preloadResources() {
    return this.queryClient.prefetchQuery({
      queryKey: resourcesKeys.lists(),
      staleTime: 1000 * 60 * 5,
    });
  }

  preloadTweets() {
    return this.queryClient.prefetchQuery({
      queryKey: tweetsKeys.lists(),
      staleTime: 1000 * 60 * 5,
    });
  }

  // Preload critical data on app start
  async preloadCriticalData() {
    try {
      await Promise.all([
        this.preloadResources(),
        this.preloadTweets(),
      ]);
      console.log('[RoutePreloader] Critical data preloaded successfully');
    } catch (error) {
      console.warn('[RoutePreloader] Failed to preload some data:', error);
    }
  }
}
