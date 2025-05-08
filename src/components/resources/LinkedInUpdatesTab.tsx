
import React from 'react';
import { LinkedInCard } from '@/components/resources/LinkedInCard';
import LoginWall from '@/components/common/LoginWall';
import { Resource } from '@/hooks/useResources'; // Assuming Resource type is exported
import { adaptResourceToLinkedIn } from '@/pages/Resources'; // adaptResourceToLinkedIn is in Resources.tsx

// Define the extended resource type that includes sourceType, mirroring Resources.tsx
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

export const LinkedInUpdatesTab: React.FC<LinkedInUpdatesTabProps> = ({
  isLoading,
  visibleLinkedIn,
  isAuthenticated,
  linkedinResourcesCount,
  loginWallVisibleItems,
}) => {
  if (isLoading) {
    // While not explicitly in the original code, adding a loading state here for consistency
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-medium mb-2">Loading LinkedIn posts...</h3>
      </div>
    );
  }

  if (visibleLinkedIn.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-medium mb-2">No LinkedIn posts found</h3>
        <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {visibleLinkedIn.map((resource) => (
        <LinkedInCard key={resource.id} post={adaptResourceToLinkedIn(resource)} />
      ))}
      {!isAuthenticated && linkedinResourcesCount > loginWallVisibleItems && (
        <div className="relative mt-8">
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

