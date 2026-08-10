
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { urlHostMatches } from '@/utils/videoUrls';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useResources, Resource, parseArrayField, normalizeString } from '@/hooks/useResources';
import { useAllTweetsData } from '@/hooks/useAllTweetsData'; 
import { FeedbackSection } from '@/components/common/FeedbackSection';

import { ResourceFilters } from '@/components/resources/ResourceFilters';
import { ResourceDirectoryTab } from '@/components/resources/ResourceDirectoryTab';
import { TopTweetsTab } from '@/components/resources/TopTweetsTab';
import { LinkedInUpdatesTab } from '@/components/resources/LinkedInUpdatesTab';

import { createLogger } from '@/utils/logger';

const logger = createLogger('adaptResourceToTweet');

const VISIBLE_RESOURCES_IN_DIRECTORY = 5;
const VISIBLE_TWEETS = 3;
const VISIBLE_LINKEDIN = 3;
const TOP_TWEETS_COUNT = 100;

export type ResourceWithSourceType = Resource & {
  sourceType: 'Tweet' | 'LinkedIn' | 'Standard';
};

// Helper functions remain here for now as they are used by useMemo hooks in this component.
// They could be moved to useResources.ts or a utils file in a further refactoring step.
const classifyResourceSource = (resource: Resource): 'Tweet' | 'LinkedIn' | 'Standard' => {
  // `source` is a free-text label, so a substring check is the right tool
  // there. `resource_link` is a URL, so it is matched by parsed hostname —
  // an unanchored includes('twitter.com') also matched
  // evil.com/twitter.com and twitter.com.evil.net (CodeQL
  // js/incomplete-url-substring-sanitization).
  if (
    resource.source?.toLowerCase().includes('twitter') ||
    (resource.resource_link && urlHostMatches(resource.resource_link, ['twitter.com', 'x.com']))
  ) {
    return 'Tweet';
  } else if (
    resource.source?.toLowerCase().includes('linkedin') ||
    (resource.resource_link && urlHostMatches(resource.resource_link, ['linkedin.com']))
  ) {
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
  logger.log('[ProcessResources] Input resources count:', resources.length);
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
  
  // Data for Resource Directory and potentially LinkedIn
  const { resources, isLoading: isLoadingMainResources } = useResources();
  
  // New dedicated data fetch for Top Tweets
  const { data: allRawTweetsData, isLoading: isLoadingTopTweets } = useAllTweetsData();

  const processedResources = useMemo(() => {
    logger.log('[ProcessResources] Input resources count:', resources.length);
    const pr = processResources(resources);
    logger.log('[ProcessResources] Processed general resources (with sourceType):', pr.length);
    return pr;
  }, [resources]);

  // Process the raw tweet data separately
  const processedAllTweets = useMemo(() => {
    const tweetsArray = allRawTweetsData || [];
    logger.log('[ResourcesPage] Raw tweets from useAllTweetsData hook:', tweetsArray.length);
    const pt = processResources(tweetsArray);
    logger.log('[ResourcesPage] Processed all tweets (with sourceType):', pt.length);
    return pt;
  }, [allRawTweetsData]);

  const uniqueCategories = useMemo(() => {
    // Filters are based on all resources for comprehensive options
    return extractUniqueValues(resources, 'career_area', 'predicted_career_labels', 'category');
  }, [resources]);

  const uniqueResourceTypes = useMemo(() => {
    // Filters are based on all resources
    return extractUniqueValues(resources, 'resource_type', 'predicted_resource_labels');
  }, [resources]);

  // Filtered resources for the Directory tab (and potentially LinkedIn if not separated later)
  const filteredMainResources = useMemo(() => {
    logger.log('[ResourcesPage] Filtering processed general resources. Count:', processedResources.length, 'Filters:', { searchQuery, categoryFilter, typeFilter, withDeadline });
    const fr = processedResources.filter(resource => matchesFilters(resource, searchQuery, categoryFilter, typeFilter, withDeadline));
    logger.log('[ResourcesPage] Filtered general resources:', fr.length);
    return fr;
  }, [processedResources, searchQuery, categoryFilter, typeFilter, withDeadline]);

  const directoryResources = useMemo(() => {
    logger.log('[ResourcesPage] Directory resources (filtered from general pool):', filteredMainResources.length);
    return filteredMainResources;
  }, [filteredMainResources]);

  // Top Global Tweets now derived from its own processed data pool
  const topGlobalTweets = useMemo(() => {
    const allTweetsForSorting = processedAllTweets.filter(r => r.sourceType === 'Tweet');
    logger.log('[ResourcesPage] All processed tweets for topGlobalTweets calc (from dedicated fetch):', allTweetsForSorting.length);
    
    const sorted = allTweetsForSorting.sort((a, b) => {
      const favCountA = Number(a.favorite_count) || 0;
      const favCountB = Number(b.favorite_count) || 0;
      
      // Sort solely by favorite_count descending
      return favCountB - favCountA;
    });
    
    const topTweets = sorted.slice(0, TOP_TWEETS_COUNT);
    logger.log('[ResourcesPage] Top global tweets (sorted solely by favorite_count, from dedicated fetch, before UI filtering):', topTweets.length);
    return topTweets;
  }, [processedAllTweets]); // Depends on processedAllTweets

  // TweetResources are the topGlobalTweets further filtered by UI controls
  const tweetResources = useMemo(() => {
    const tr = topGlobalTweets.filter(resource => matchesFilters(resource, searchQuery, categoryFilter, typeFilter, withDeadline));
    logger.log('[ResourcesPage] Filtered Tweet resources (for Tweet Tab display):', tr.length);
    return tr;
  }, [topGlobalTweets, searchQuery, categoryFilter, typeFilter, withDeadline]);

  const linkedinResources = useMemo(() => {
    // LinkedIn resources are still derived from the main filtered pool
    const lr = filteredMainResources.filter(r => r.sourceType === 'LinkedIn');
    logger.log('[ResourcesPage] LinkedIn resources (for LinkedIn Tab):', lr.length);
    return lr;
  }, [filteredMainResources]);

  // Since this is now a public page, we'll show limited content even for non-authenticated users
  // Full content is still only available after login
  const visibleDirectoryResources = isAuthenticated ? directoryResources : directoryResources.slice(0, VISIBLE_RESOURCES_IN_DIRECTORY);
  const visibleTweets = isAuthenticated ? tweetResources : tweetResources.slice(0, VISIBLE_TWEETS);
  const visibleLinkedIn = isAuthenticated ? linkedinResources : linkedinResources.slice(0, VISIBLE_LINKEDIN);

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setTypeFilter('all');
    setWithDeadline(false);
    logger.log('[ResourcesPage] Filters cleared.');
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
      {/* fullWidth means AppLayout adds no gutter, so this page owes one. It had
          none, and its cards sat flush against both viewport edges. */}
      <div className="space-y-8 w-full px-4 sm:px-6 py-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-center">Resources</h1>
          <p className="text-muted-foreground mt-2 text-center">
            Discover helpful resources, events, and learning opportunities.
          </p>
        </div>

        {/* Entry point into the salary guide, which is a standalone reference page
            rather than a directory row. */}
        <Link
          to="/resources/salary-guide"
          className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4 hover:border-primary transition-colors"
        >
          <span>
            <span className="block font-semibold">Data &amp; AI salary guide</span>
            <span className="block text-sm text-muted-foreground">
              US salary bands for 20+ data, analytics and AI roles, from BLS wage data.
            </span>
          </span>
          <ArrowRight className="h-5 w-5 text-primary shrink-0" />
        </Link>

        
        <Tabs defaultValue="resources" className="space-y-8 w-full">
          <TabsList>
            <TabsTrigger value="resources">Resource Directory</TabsTrigger>
            <TabsTrigger value="tweets">Top Tweets</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn Updates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="resources" className="space-y-6 w-full">
            <ResourceFilters {...commonFilterProps} searchPlaceholder="Search resources..." />
            <ResourceDirectoryTab
              isLoading={isLoadingMainResources} // Uses main loading state
              visibleDirectoryResources={visibleDirectoryResources}
              isAuthenticated={isAuthenticated}
              directoryResourcesCount={directoryResources.length}
              loginWallVisibleItems={VISIBLE_RESOURCES_IN_DIRECTORY}
            />
          </TabsContent>
          
          <TabsContent value="tweets" className="space-y-6 w-full">
            <ResourceFilters {...commonFilterProps} searchPlaceholder="Search top tweets..." />
            <TopTweetsTab
              isLoading={isLoadingTopTweets} // Uses dedicated loading state for tweets
              visibleTweets={visibleTweets}
              isAuthenticated={isAuthenticated}
              tweetResourcesCount={tweetResources.length}
              topGlobalTweetsCount={topGlobalTweets.length} // This is the count of tweets *after* TOP_TWEETS_COUNT slice
              loginWallVisibleItems={VISIBLE_TWEETS}
            />
          </TabsContent>
          
          <TabsContent value="linkedin" className="space-y-6 w-full">
            <ResourceFilters {...commonFilterProps} searchPlaceholder="Search LinkedIn posts..." />
            <LinkedInUpdatesTab
              isLoading={isLoadingMainResources} // Uses main loading state
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
