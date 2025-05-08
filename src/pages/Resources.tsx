
import { useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
// Input, Button, Selects, Checkbox, Search, FilterX are now used in ResourceFilters
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useResources, Resource, parseArrayField, normalizeString } from '@/hooks/useResources';
import { FeedbackSection } from '@/components/common/FeedbackSection';

// Import new components
import { ResourceFilters } from '@/components/resources/ResourceFilters';
import { ResourceDirectoryTab } from '@/components/resources/ResourceDirectoryTab';
import { TopTweetsTab } from '@/components/resources/TopTweetsTab';
import { LinkedInUpdatesTab } from '@/components/resources/LinkedInUpdatesTab';

const VISIBLE_RESOURCES_IN_DIRECTORY = 5;
const VISIBLE_TWEETS = 3;
const VISIBLE_LINKEDIN = 3;
const TOP_TWEETS_COUNT = 100;

// Define the extended resource type that includes sourceType
// This type definition is used by child components as well, so it's good it's exported or defined where accessible.
// For now, child components import it or define it locally if they are in separate files.
// If we move this to a central types file, update imports.
export type ResourceWithSourceType = Resource & {
  sourceType: 'Tweet' | 'LinkedIn' | 'Standard';
};

// Helper functions remain here for now as they are used by useMemo hooks in this component.
// They could be moved to useResources.ts or a utils file in a further refactoring step.
const classifyResourceSource = (resource: Resource): 'Tweet' | 'LinkedIn' | 'Standard' => {
  if (resource.source?.toLowerCase().includes('twitter') || resource.resource_link && resource.resource_link.toLowerCase().includes('twitter.com')) {
    return 'Tweet';
  } else if (resource.source?.toLowerCase().includes('linkedin') || resource.resource_link && resource.resource_link.toLowerCase().includes('linkedin.com')) {
    return 'LinkedIn';
  }
  return 'Standard';
};

const extractUniqueValues = (resources: Resource[], primaryField: keyof Resource, secondaryField?: keyof Resource, additionalStaticField?: keyof Resource): string[] => {
  const values = new Set<string>();
  resources.forEach(resource => {
    if (resource[primaryField]) {
      parseArrayField(resource[primaryField] as string | null).forEach(val => values.add(normalizeString(val)));
    }
    if (secondaryField && resource[secondaryField]) {
      parseArrayField(resource[secondaryField] as string | null).forEach(val => values.add(normalizeString(val)));
    }
    if (additionalStaticField && resource[additionalStaticField] && (resource[additionalStaticField] as string)?.toLowerCase() !== 'general') {
      parseArrayField(resource[additionalStaticField] as string | null).forEach(val => values.add(normalizeString(val)));
    }
  });
  return Array.from(values).filter(Boolean).sort();
};

const processResources = (resources: Resource[]): ResourceWithSourceType[] => {
  console.log('[ProcessResources] Input resources count:', resources.length);
  return resources.map(resource => {
    const sourceType = classifyResourceSource(resource);
    return {
      ...resource,
      sourceType
    };
  });
};

const matchesFilters = (resource: ResourceWithSourceType, searchQuery: string, categoryFilter: string, typeFilter: string, withDeadline: boolean): boolean => {
  const searchText = searchQuery.toLowerCase();
  const searchableText = [resource.full_text, resource.resource_type, resource.predicted_resource_labels, resource.career_area, resource.predicted_career_labels, resource.category, resource.source, resource.resource_link].filter(Boolean).join(' ').toLowerCase();
  const matchesSearch = searchQuery === '' || searchableText.includes(searchText);
  const resourceCategories = new Set<string>();
  if (resource.career_area) parseArrayField(resource.career_area).forEach(label => resourceCategories.add(normalizeString(label)));
  if (resource.predicted_career_labels) parseArrayField(resource.predicted_career_labels).forEach(label => resourceCategories.add(normalizeString(label)));
  if (resource.category) parseArrayField(resource.category).forEach(label => resourceCategories.add(normalizeString(label)));
  if (resourceCategories.size === 0 && resource.sourceType === 'Standard') resourceCategories.add('General');
  const categoryMatches = categoryFilter === 'all' || Array.from(resourceCategories).includes(categoryFilter) || categoryFilter === 'General' && resourceCategories.size === 0 && resource.sourceType === 'Standard';
  const resourceTypesSet = new Set<string>();
  if (resource.resource_type) parseArrayField(resource.resource_type).forEach(label => resourceTypesSet.add(normalizeString(label)));
  if (resource.predicted_resource_labels) parseArrayField(resource.predicted_resource_labels).forEach(label => resourceTypesSet.add(normalizeString(label)));
  if (resourceTypesSet.size === 0 && resource.sourceType === 'Standard') resourceTypesSet.add('Resource');
  const typeMatches = typeFilter === 'all' || Array.from(resourceTypesSet).includes(typeFilter) || typeFilter === 'Resource' && resourceTypesSet.size === 0 && resource.sourceType === 'Standard';
  const deadlineMatches = withDeadline ? !!resource.deadline : true;
  const finalMatch = matchesSearch && categoryMatches && typeMatches && deadlineMatches;
  return finalMatch;
};

// Export adapter functions so they can be imported by child components
export const adaptResourceToTweet = (resource: Resource) => {
  let tweetUrl = resource.resource_link;
  if (!tweetUrl && resource.source?.toLowerCase().includes('twitter') && resource.tweet_id) {
    tweetUrl = `https://x.com/teneikaask_you/status/${resource.tweet_id}`;
  }
  const likes = Math.max(Number(resource.favorite_count) || 0, Number(resource.tweet_likes) || 0);
  const retweets = Math.max(Number(resource.retweet_count) || 0, Number(resource.tweet_retweets) || 0);
  return {
    id: resource.id,
    content: resource.full_text || '',
    date: resource.created_at || '',
    url: tweetUrl || '',
    likes: likes,
    retweets: retweets
  };
};

export const adaptResourceToLinkedIn = (resource: Resource) => {
  const resourceTypesList: string[] = [];
  if (resource.resource_type) resourceTypesList.push(...parseArrayField(resource.resource_type).map(normalizeString));
  if (resource.predicted_resource_labels) {
    resourceTypesList.push(...parseArrayField(resource.predicted_resource_labels).map(normalizeString));
  }
  const title = resourceTypesList.length > 0 && resourceTypesList[0] !== 'Resource' ? resourceTypesList[0] : 'LinkedIn Post';
  return {
    id: resource.id,
    title,
    description: resource.full_text || '',
    date: resource.created_at || '',
    url: resource.resource_link || ''
  };
};

const Resources = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [withDeadline, setWithDeadline] = useState(false);
  const { isAuthenticated } = useAuth();
  const { resources, isLoading } = useResources();

  const processedResources = useMemo(() => {
    console.log('[ResourcesPage] Raw resources from hook:', resources.length);
    const pr = processResources(resources);
    console.log('[ResourcesPage] Processed resources (with sourceType):', pr.length);
    return pr;
  }, [resources]);

  const uniqueCategories = useMemo(() => {
    return extractUniqueValues(resources, 'career_area', 'predicted_career_labels', 'category');
  }, [resources]);

  const uniqueResourceTypes = useMemo(() => {
    return extractUniqueValues(resources, 'resource_type', 'predicted_resource_labels');
  }, [resources]);

  const filteredResources = useMemo(() => {
    console.log('[ResourcesPage] Filtering processed resources. Count:', processedResources.length, 'Filters:', { searchQuery, categoryFilter, typeFilter, withDeadline });
    const fr = processedResources.filter(resource => matchesFilters(resource, searchQuery, categoryFilter, typeFilter, withDeadline));
    console.log('[ResourcesPage] Filtered resources (for all tabs potentially):', fr.length);
    return fr;
  }, [processedResources, searchQuery, categoryFilter, typeFilter, withDeadline]);

  const directoryResources = useMemo(() => {
    console.log('[ResourcesPage] Directory resources (all filtered items for the main tab):', filteredResources.length);
    return filteredResources;
  }, [filteredResources]);

  const topGlobalTweets = useMemo(() => {
    const allTweets = processedResources.filter(r => r.sourceType === 'Tweet');
    console.log('[ResourcesPage] All processed tweets for topGlobalTweets calc:', allTweets.length);
    const sorted = allTweets.sort((a, b) => {
      const likesA = Math.max(Number(a.favorite_count) || 0, Number(a.tweet_likes) || 0);
      const retweetsA = Math.max(Number(a.retweet_count) || 0, Number(a.tweet_retweets) || 0);
      const scoreA = likesA + retweetsA;
      const likesB = Math.max(Number(b.favorite_count) || 0, Number(b.tweet_likes) || 0);
      const retweetsB = Math.max(Number(b.retweet_count) || 0, Number(b.tweet_retweets) || 0);
      const scoreB = likesB + retweetsB;
      if (scoreB === scoreA) {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      return scoreB - scoreA;
    });
    const topTweets = sorted.slice(0, TOP_TWEETS_COUNT);
    console.log('[ResourcesPage] Top global tweets (before filtering for tab display):', topTweets.length);
    return topTweets;
  }, [processedResources]);

  const tweetResources = useMemo(() => {
    const tr = topGlobalTweets.filter(resource => matchesFilters(resource, searchQuery, categoryFilter, typeFilter, withDeadline));
    console.log('[ResourcesPage] Filtered Tweet resources (for Tweet Tab):', tr.length);
    return tr;
  }, [topGlobalTweets, searchQuery, categoryFilter, typeFilter, withDeadline]);

  const linkedinResources = useMemo(() => {
    const lr = filteredResources.filter(r => r.sourceType === 'LinkedIn');
    console.log('[ResourcesPage] LinkedIn resources (for LinkedIn Tab):', lr.length);
    return lr;
  }, [filteredResources]);

  const visibleDirectoryResources = isAuthenticated ? directoryResources : directoryResources.slice(0, VISIBLE_RESOURCES_IN_DIRECTORY);
  console.log('[ResourcesPage] Visible Directory Resources (for main tab display):', visibleDirectoryResources.length);
  const visibleTweets = isAuthenticated ? tweetResources : tweetResources.slice(0, VISIBLE_TWEETS);
  const visibleLinkedIn = isAuthenticated ? linkedinResources : linkedinResources.slice(0, VISIBLE_LINKEDIN);

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setTypeFilter('all');
    setWithDeadline(false);
    console.log('[ResourcesPage] Filters cleared.');
  };

  const commonFilterProps = {
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    typeFilter,
    setTypeFilter,
    withDeadline,
    setWithDeadline,
    uniqueCategories,
    uniqueResourceTypes,
    clearFilters,
  };

  return (
    <AppLayout fullWidth={true}>
      <div className="space-y-8 w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-center">Resources</h1>
          <p className="text-muted-foreground mt-2 text-center">
            Discover helpful resources, events, and learning opportunities.
          </p>
        </div>
        
        <Tabs defaultValue="resources" className="space-y-8 w-full">
          <TabsList>
            <TabsTrigger value="resources">Resource Directory</TabsTrigger>
            <TabsTrigger value="tweets">Top Tweets</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn Updates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="resources" className="space-y-6 w-full">
            <ResourceFilters {...commonFilterProps} searchPlaceholder="Search resources..." />
            <ResourceDirectoryTab
              isLoading={isLoading}
              visibleDirectoryResources={visibleDirectoryResources}
              isAuthenticated={isAuthenticated}
              directoryResourcesCount={directoryResources.length}
              loginWallVisibleItems={VISIBLE_RESOURCES_IN_DIRECTORY}
            />
          </TabsContent>
          
          <TabsContent value="tweets" className="space-y-6 w-full">
            <ResourceFilters {...commonFilterProps} searchPlaceholder="Search top tweets..." />
            <TopTweetsTab
              isLoading={isLoading}
              visibleTweets={visibleTweets}
              isAuthenticated={isAuthenticated}
              tweetResourcesCount={tweetResources.length}
              topGlobalTweetsCount={topGlobalTweets.length}
              loginWallVisibleItems={VISIBLE_TWEETS}
            />
          </TabsContent>
          
          <TabsContent value="linkedin" className="space-y-6 w-full">
            <ResourceFilters {...commonFilterProps} searchPlaceholder="Search LinkedIn posts..." />
            <LinkedInUpdatesTab
              isLoading={isLoading} // Assuming isLoading applies here too
              visibleLinkedIn={visibleLinkedIn}
              isAuthenticated={isAuthenticated}
              linkedinResourcesCount={linkedinResources.length}
              loginWallVisibleItems={VISIBLE_LINKEDIN}
            />
          </TabsContent>
        </Tabs>
        
        <FeedbackSection pagePath="/resources" />
      </div>
    </AppLayout>
  );
};
export default Resources;

