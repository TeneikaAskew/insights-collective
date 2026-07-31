
import React from 'react';
import { ResourceCard } from '@/components/resources/ResourceCard';
import LoginWall from '@/components/common/LoginWall';
import { Resource } from '@/hooks/useResources'; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Grid2X2, Layout, LayoutList } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Define the extended resource type that includes sourceType
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

// Skeleton placeholder for resource cards during loading
const ResourceCardSkeleton = ({ isListView = false }: { isListView?: boolean }) => {
  if (isListView) {
    return (
      <div className="w-full border rounded-lg p-4 shadow-sm">
        <div className="flex flex-col md:flex-row">
          <div className="md:w-2/3 space-y-2">
            <div className="flex flex-wrap gap-1 mb-2">
              <Skeleton className="h-6 w-20 rounded" />
              <Skeleton className="h-6 w-16 rounded" />
            </div>
            <Skeleton className="h-16 w-full" />
            <div className="flex flex-wrap gap-1 mt-2">
              <Skeleton className="h-6 w-16 rounded" />
              <Skeleton className="h-6 w-14 rounded" />
            </div>
          </div>
          <div className="md:w-1/3 bg-muted p-4 flex flex-col justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full mt-2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 shadow-sm h-full flex flex-col">
      <div className="space-y-2 mb-4">
        <div className="flex flex-wrap gap-1 mb-2">
          <Skeleton className="h-6 w-20 rounded" />
          <Skeleton className="h-6 w-16 rounded" />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="flex-grow">
        <Skeleton className="h-4 w-32 mb-2" />
      </div>
      <div className="space-y-3 mt-4">
        <Skeleton className="h-10 w-full" />
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-6 w-16 rounded" />
          <Skeleton className="h-6 w-14 rounded" />
        </div>
      </div>
    </div>
  );
};

export const ResourceDirectoryTab: React.FC<ResourceDirectoryTabProps> = ({
  isLoading,
  visibleDirectoryResources,
  isAuthenticated,
  directoryResourcesCount,
  loginWallVisibleItems,
}) => {
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');

  // Show skeleton placeholders during loading
  if (isLoading) {
    return (
      <div className="w-full">
        <div className="flex justify-end space-x-2 mb-6">
          <div className="bg-muted rounded-lg p-1 flex">
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'ghost'} 
              size="sm"
              className="rounded-r-none"
              disabled
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'} 
              size="sm"
              className="rounded-l-none"
              disabled
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 w-full">
            {[...Array(6)].map((_, index) => (
              <ResourceCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {[...Array(6)].map((_, index) => (
              <ResourceCardSkeleton key={index} isListView={true} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (visibleDirectoryResources.length === 0) {
    return (
      <div className="text-center py-12 bg-muted rounded-lg">
        <h3 className="text-xl font-medium mb-2">No resources found</h3>
        <p className="text-muted-foreground mb-4">Try adjusting your search or filter criteria</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh Resources
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex justify-end space-x-2">
        <div className="bg-muted rounded-lg p-1 flex">
          <Button 
            variant={viewMode === 'grid' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-r-none"
          >
            <Grid2X2 className="h-4 w-4" />
            <span className="sr-only">Grid View</span>
          </Button>
          <Button 
            variant={viewMode === 'list' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-l-none"
          >
            <LayoutList className="h-4 w-4" />
            <span className="sr-only">List View</span>
          </Button>
        </div>
      </div>
      
      {viewMode === 'grid' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 w-full">
          {visibleDirectoryResources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : (
        <div className="space-y-4 w-full">
          {visibleDirectoryResources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} isListView={true} />
          ))}
        </div>
      )}
      
      {!isAuthenticated && directoryResourcesCount > loginWallVisibleItems && (
        <div className="w-full">
          <LoginWall
            message={`Unlock all ${directoryResourcesCount}+ curated resources — log in or create an account to continue exploring.`}
            visibleItems={loginWallVisibleItems}
            totalItems={directoryResourcesCount}
          />
        </div>
      )}
    </div>
  );
};
