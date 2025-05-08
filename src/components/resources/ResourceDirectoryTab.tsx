
import React from 'react';
import { ResourceCard } from '@/components/resources/ResourceCard';
import LoginWall from '@/components/common/LoginWall';
import { Resource } from '@/hooks/useResources'; // Assuming Resource type is exported from useResources

// Define the extended resource type that includes sourceType, mirroring Resources.tsx
export type ResourceWithSourceType = Resource & {
  sourceType: 'Tweet' | 'LinkedIn' | 'Standard';
};

interface ResourceDirectoryTabProps {
  isLoading: boolean;
  visibleDirectoryResources: ResourceWithSourceType[];
  isAuthenticated: boolean;
  directoryResourcesCount: number;
  loginWallVisibleItems: number;
}

export const ResourceDirectoryTab: React.FC<ResourceDirectoryTabProps> = ({
  isLoading,
  visibleDirectoryResources,
  isAuthenticated,
  directoryResourcesCount,
  loginWallVisibleItems,
}) => {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-medium mb-2">Loading resources...</h3>
      </div>
    );
  }

  if (visibleDirectoryResources.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-medium mb-2">No resources found</h3>
        <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visibleDirectoryResources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
        {!isAuthenticated && directoryResourcesCount > loginWallVisibleItems && (
          <div className="md:col-span-2 lg:col-span-3">
            <LoginWall
              message={`Unlock all ${directoryResourcesCount}+ curated resources — log in or create an account to continue exploring.`}
              visibleItems={loginWallVisibleItems}
              totalItems={directoryResourcesCount}
            />
          </div>
        )}
      </div>
    </div>
  );
};

