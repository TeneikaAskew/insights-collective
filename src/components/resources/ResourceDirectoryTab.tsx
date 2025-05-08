
import React from 'react';
import { ResourceCard } from '@/components/resources/ResourceCard';
import LoginWall from '@/components/common/LoginWall';
import { Resource } from '@/hooks/useResources'; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Grid2X2, Layout, LayoutList } from 'lucide-react';

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

export const ResourceDirectoryTab: React.FC<ResourceDirectoryTabProps> = ({
  isLoading,
  visibleDirectoryResources,
  isAuthenticated,
  directoryResourcesCount,
  loginWallVisibleItems,
}) => {
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <h3 className="text-xl font-medium">Loading resources...</h3>
        </div>
      </div>
    );
  }

  if (visibleDirectoryResources.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex">
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
