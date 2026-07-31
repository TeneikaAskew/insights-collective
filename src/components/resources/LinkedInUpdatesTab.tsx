
import React from 'react';
import { LinkedInCard } from '@/components/resources/LinkedInCard';
import LoginWall from '@/components/common/LoginWall';
import { Resource } from '@/hooks/useResources';
import { adaptResourceToLinkedIn } from '@/pages/Resources';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Linkedin } from 'lucide-react';

// Define the extended resource type that includes sourceType
export type ResourceWithSourceType = Resource & {
  sourceType: 'Tweet' | 'LinkedIn' | 'Standard';
};

interface LinkedInUpdatesTabProps {
  isLoading: boolean;
  visibleLinkedIn: ResourceWithSourceType[];
  isAuthenticated: boolean;
  linkedinResourcesCount: number;
  loginWallVisibleItems: number;
}

// Skeleton component for LinkedIn posts during loading
const LinkedInCardSkeleton = () => {
  return (
    <div className="border rounded-lg p-4 shadow-sm">
      <div className="flex items-start space-x-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full mt-2" />
        </div>
      </div>
    </div>
  );
};

export const LinkedInUpdatesTab: React.FC<LinkedInUpdatesTabProps> = ({
  isLoading,
  visibleLinkedIn,
  isAuthenticated,
  linkedinResourcesCount,
  loginWallVisibleItems,
}) => {
  // Show advanced skeleton loading state
  if (isLoading) {
    return (
      <div className="space-y-8 w-full">
        {[...Array(2)].map((_, categoryIndex) => (
          <div key={`category-${categoryIndex}`} className="space-y-4">
            <div className="flex items-center space-x-2">
              <Linkedin className="h-5 w-5 text-ss-teal" />
              <Skeleton className="h-6 w-32" />
            </div>
            
            <div className="space-y-4">
              {[...Array(2)].map((_, postIndex) => (
                <LinkedInCardSkeleton key={`post-${categoryIndex}-${postIndex}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (visibleLinkedIn.length === 0) {
    return (
      <div className="text-center py-12 bg-muted rounded-lg w-full">
        <h3 className="text-xl font-medium mb-2">No LinkedIn posts found</h3>
        <p className="text-muted-foreground mb-4">
          Try adjusting your search or filter criteria
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh LinkedIn Posts
        </Button>
      </div>
    );
  }

  // Group LinkedIn posts by category for better organization
  const categorizedPosts: { [key: string]: Resource[] } = {};
  visibleLinkedIn.forEach(resource => {
    const categories = resource.career_area?.split(',') || ['General'];
    const mainCategory = categories[0].trim();
    if (!categorizedPosts[mainCategory]) {
      categorizedPosts[mainCategory] = [];
    }
    categorizedPosts[mainCategory].push(resource);
  });

  return (
    <div className="space-y-8 w-full">
      {Object.entries(categorizedPosts).map(([category, resources]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center space-x-2">
            <Linkedin className="h-5 w-5 text-ss-teal" />
            <h3 className="text-lg font-medium">{category}</h3>
          </div>
          <div className="space-y-4">
            {resources.map(resource => (
              <LinkedInCard 
                key={resource.id}
                post={adaptResourceToLinkedIn(resource)} 
              />
            ))}
          </div>
        </div>
      ))}
      
      {!isAuthenticated && linkedinResourcesCount > loginWallVisibleItems && (
        <div className="relative mt-8 w-full">
          <LoginWall
            message="Sign in to view more insights from our LinkedIn community."
            visibleItems={loginWallVisibleItems}
            totalItems={linkedinResourcesCount}
          />
        </div>
      )}
    </div>
  );
};
