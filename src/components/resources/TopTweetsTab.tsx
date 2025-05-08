
import React from 'react';
import { TweetCard } from '@/components/resources/TweetCard';
import LoginWall from '@/components/common/LoginWall';
import { Resource } from '@/hooks/useResources';
import { adaptResourceToTweet } from '@/pages/Resources';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';

// Define the extended resource type that includes sourceType
export type ResourceWithSourceType = Resource & {
  sourceType: 'Tweet' | 'LinkedIn' | 'Standard';
};

interface TopTweetsTabProps {
  isLoading: boolean;
  visibleTweets: ResourceWithSourceType[];
  isAuthenticated: boolean;
  tweetResourcesCount: number;
  topGlobalTweetsCount: number;
  loginWallVisibleItems: number;
}

export const TopTweetsTab: React.FC<TopTweetsTabProps> = ({
  isLoading,
  visibleTweets,
  isAuthenticated,
  tweetResourcesCount,
  topGlobalTweetsCount,
  loginWallVisibleItems,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4 w-full">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <div className="flex items-start space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-12 w-full" />
                <div className="flex space-x-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (visibleTweets.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-xl font-medium mb-2">No tweets found</h3>
        <p className="text-muted-foreground mb-4">
          Try adjusting your search or filter criteria, or check back later for new top tweets.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh Tweets
        </Button>
      </div>
    );
  }

  // Display a highlighted top tweet if there's at least one
  const topTweet = visibleTweets[0];
  const remainingTweets = visibleTweets.slice(1);
  
  return (
    <div className="space-y-6 w-full">
      {topTweet && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 mb-6">
          <div className="flex items-center mb-2 text-blue-600 dark:text-blue-400">
            <TrendingUp className="h-5 w-5 mr-2" />
            <h3 className="font-semibold">Top Trending Tweet</h3>
          </div>
          <TweetCard 
            key={topTweet.id} 
            tweet={adaptResourceToTweet(topTweet)} 
            highlighted={true} 
          />
        </div>
      )}
      
      <div className="space-y-4 w-full">
        {remainingTweets.map((resource) => (
          <TweetCard key={resource.id} tweet={adaptResourceToTweet(resource)} />
        ))}
      </div>
      
      {!isAuthenticated && tweetResourcesCount > loginWallVisibleItems && tweetResourcesCount < topGlobalTweetsCount && (
        <div className="relative mt-8 w-full">
          <LoginWall
            message={`Sign in to view all ${tweetResourcesCount} filtered top tweets.`}
            visibleItems={loginWallVisibleItems}
            totalItems={tweetResourcesCount}
          />
        </div>
      )}
      
      {!isAuthenticated && topGlobalTweetsCount > loginWallVisibleItems && tweetResourcesCount === topGlobalTweetsCount && (
        <div className="relative mt-8 w-full">
          <LoginWall
            message={`Sign in to view all ${topGlobalTweetsCount} top tweets.`}
            visibleItems={loginWallVisibleItems}
            totalItems={topGlobalTweetsCount}
          />
        </div>
      )}
    </div>
  );
};
