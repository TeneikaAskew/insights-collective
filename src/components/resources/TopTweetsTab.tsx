
import React from 'react';
import { TweetCard } from '@/components/resources/TweetCard';
import LoginWall from '@/components/common/LoginWall';
import { Resource } from '@/hooks/useResources'; // Assuming Resource type is exported
import { adaptResourceToTweet } from '@/pages/Resources'; // adaptResourceToTweet is in Resources.tsx

// Define the extended resource type that includes sourceType, mirroring Resources.tsx
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
      <div className="text-center py-12">
        <h3 className="text-xl font-medium mb-2">Loading top tweets...</h3>
      </div>
    );
  }

  if (visibleTweets.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-medium mb-2">No top tweets found</h3>
        <p className="text-muted-foreground">Try adjusting your search or filter criteria, or check back later for new top tweets.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 w-full">
      {visibleTweets.map((resource) => (
        <TweetCard key={resource.id} tweet={adaptResourceToTweet(resource)} />
      ))}
      {!isAuthenticated && tweetResourcesCount > loginWallVisibleItems && tweetResourcesCount < topGlobalTweetsCount && (
        <div className="relative mt-8">
          <LoginWall
            message={`Sign in to view all ${tweetResourcesCount} filtered top tweets.`}
            visibleItems={loginWallVisibleItems}
            totalItems={tweetResourcesCount}
          />
        </div>
      )}
      {!isAuthenticated && topGlobalTweetsCount > loginWallVisibleItems && tweetResourcesCount === topGlobalTweetsCount && (
         <div className="relative mt-8">
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

