import { useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// Badge import is not directly used in this file's JSX, but ResourceCard uses it.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FilterX } from 'lucide-react'; // Removed unused ExternalLink, Calendar
import { useAuth } from '@/contexts/AuthContext';
import LoginWall from '@/components/common/LoginWall';
import { Checkbox } from '@/components/ui/checkbox';
import { useResources, Resource, parseArrayField, normalizeString } from '@/hooks/useResources';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { TweetCard } from '@/components/resources/TweetCard';
import { LinkedInCard } from '@/components/resources/LinkedInCard';
import { FeedbackSection } from '@/components/common/FeedbackSection';

const VISIBLE_RESOURCES_IN_DIRECTORY = 5; // Renamed for clarity, was VISIBLE_RESOURCES
const VISIBLE_TWEETS = 3; 
const VISIBLE_LINKEDIN = 3;
const TOP_TWEETS_COUNT = 100;

const classifyResourceSource = (resource: Resource): 'Tweet' | 'LinkedIn' | 'Standard' => {
  if (resource.source?.toLowerCase().includes('twitter') || 
      (resource.resource_link && resource.resource_link.toLowerCase().includes('twitter.com'))) {
    return 'Tweet';
  } else if (resource.source?.toLowerCase().includes('linkedin') || 
            (resource.resource_link && resource.resource_link.toLowerCase().includes('linkedin.com'))) {
    return 'LinkedIn';
  }
  return 'Standard';
};

const extractUniqueValues = (
  resources: Resource[],
  primaryField: keyof Resource,
  secondaryField?: keyof Resource,
  additionalStaticField?: keyof Resource,
): string[] => {
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


const processResources = (resources: Resource[]): (Resource & { 
  sourceType: 'Tweet' | 'LinkedIn' | 'Standard';
})[] => {
  console.log('[ProcessResources] Input resources count:', resources.length);
  return resources.map(resource => {
    const sourceType = classifyResourceSource(resource);
    // console.log(`[ProcessResources] Resource ID ${resource.id} classified as ${sourceType}`);
    return {
      ...resource,
      sourceType,
    };
  });
};

const matchesFilters = (
  resource: Resource, 
  searchQuery: string, 
  categoryFilter: string, 
  typeFilter: string,     
  withDeadline: boolean
): boolean => {
  const searchText = searchQuery.toLowerCase();
  
  const searchableText = [
    resource.full_text,
    resource.resource_type,
    resource.predicted_resource_labels,
    resource.career_area,
    resource.predicted_career_labels,
    resource.category,
    resource.source,
    resource.resource_link,
  ].filter(Boolean).join(' ').toLowerCase();

  const matchesSearch = searchQuery === '' || searchableText.includes(searchText);

  const resourceCategories = new Set<string>();
  if (resource.career_area) parseArrayField(resource.career_area).forEach(label => resourceCategories.add(normalizeString(label)));
  if (resource.predicted_career_labels) parseArrayField(resource.predicted_career_labels).forEach(label => resourceCategories.add(normalizeString(label)));
  if (resource.category) parseArrayField(resource.category).forEach(label => resourceCategories.add(normalizeString(label)));
  if (resourceCategories.size === 0 && resource.sourceType === 'Standard') resourceCategories.add('General'); // Only add 'General' if truly no categories for Standard
  
  const categoryMatches = categoryFilter === 'all' || Array.from(resourceCategories).includes(categoryFilter) || (categoryFilter === 'General' && resourceCategories.size === 0 && resource.sourceType === 'Standard');


  const resourceTypesSet = new Set<string>();
  if (resource.resource_type) parseArrayField(resource.resource_type).forEach(label => resourceTypesSet.add(normalizeString(label)));
  if (resource.predicted_resource_labels) parseArrayField(resource.predicted_resource_labels).forEach(label => resourceTypesSet.add(normalizeString(label)));
  if (resourceTypesSet.size === 0 && resource.sourceType === 'Standard') resourceTypesSet.add('Resource'); // Only add 'Resource' if truly no types for Standard

  const typeMatches = typeFilter === 'all' || Array.from(resourceTypesSet).includes(typeFilter) || (typeFilter === 'Resource' && resourceTypesSet.size === 0 && resource.sourceType === 'Standard');
  
  const deadlineMatches = withDeadline ? !!resource.deadline : true;
  
  const finalMatch = matchesSearch && categoryMatches && typeMatches && deadlineMatches;
  // if (!finalMatch) {
  //   console.log(`[MatchesFilters] Resource ID ${resource.id} DID NOT MATCH:`, { matchesSearch, categoryMatches, typeMatches, deadlineMatches, searchQuery, categoryFilter, typeFilter, withDeadline, resourceCategories: Array.from(resourceCategories), resourceTypesSet: Array.from(resourceTypesSet) });
  // } else {
  //   console.log(`[MatchesFilters] Resource ID ${resource.id} MATCHED`);
  // }
  return finalMatch;
};

const adaptResourceToTweet = (resource: Resource) => {
  // Create tweet URL if needed
  let tweetUrl = resource.resource_link;
  if (!tweetUrl && resource.source?.toLowerCase().includes('twitter') && resource.tweet_id) {
    tweetUrl = `https://x.com/teneikaask_you/status/${resource.tweet_id}`;
  }

  return {
    id: resource.id,
    content: resource.full_text || '',
    date: resource.created_at || '',
    url: tweetUrl || '',
    likes: resource.favorite_count || resource.tweet_likes || 0,
    retweets: resource.retweet_count || resource.tweet_retweets || 0
  };
};

const adaptResourceToLinkedIn = (resource: Resource) => {
  const resourceTypesList: string[] = [];
  if (resource.resource_type) resourceTypesList.push(...parseArrayField(resource.resource_type).map(normalizeString));
  if (resource.predicted_resource_labels) {
    resourceTypesList.push(...parseArrayField(resource.predicted_resource_labels).map(normalizeString));
  }
  
  const title = resourceTypesList.length > 0 && resourceTypesList[0] !== 'Resource'
    ? resourceTypesList[0]
    : 'LinkedIn Post';
  
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
    console.log('[ResourcesPage] Raw resources from hook:', resources);
    const pr = processResources(resources);
    console.log('[ResourcesPage] Processed resources (with sourceType):', pr);
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
    const fr = processedResources.filter(resource => 
      matchesFilters(
        resource, 
        searchQuery, 
        categoryFilter, 
        typeFilter,     
        withDeadline
      )
    );
    console.log('[ResourcesPage] Filtered resources (for all tabs potentially):', fr);
    return fr;
  }, [processedResources, searchQuery, categoryFilter, typeFilter, withDeadline]);
  
  // THIS IS THE MAIN CHANGE: "Resource Directory" tab uses all filteredResources
  const directoryResources = useMemo(() => {
    console.log('[ResourcesPage] Directory resources (all filtered items for the main tab):', filteredResources);
    return filteredResources;
  }, [filteredResources]);
  
  const topGlobalTweets = useMemo(() => {
    const allTweets = processedResources.filter(r => r.sourceType === 'Tweet');
    console.log('[ResourcesPage] All processed tweets for topGlobalTweets calc:', allTweets);
    const sorted = allTweets
      .sort((a, b) => {
        const scoreA = (a.favorite_count || a.tweet_likes || 0) + (a.retweet_count || a.tweet_retweets || 0);
        const scoreB = (b.favorite_count || b.tweet_likes || 0) + (b.retweet_count || b.tweet_retweets || 0);
        if (scoreB === scoreA) {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        }
        return scoreB - scoreA;
      });
    const topTweets = sorted.slice(0, TOP_TWEETS_COUNT);
    console.log('[ResourcesPage] Top global tweets (before filtering for tab display):', topTweets);
    return topTweets;
  }, [processedResources]);

  const tweetResources = useMemo(() => {
    // Filters the topGlobalTweets based on current page filters
    const tr = topGlobalTweets.filter(resource =>
      matchesFilters(
        resource,
        searchQuery,
        categoryFilter,
        typeFilter,
        withDeadline
      )
    );
    console.log('[ResourcesPage] Filtered Tweet resources (for Tweet Tab):', tr);
    return tr;
  }, [topGlobalTweets, searchQuery, categoryFilter, typeFilter, withDeadline]);

  const linkedinResources = useMemo(() => {
    const lr = filteredResources.filter(r => r.sourceType === 'LinkedIn');
    console.log('[ResourcesPage] LinkedIn resources (for LinkedIn Tab):', lr);
    return lr;
  }, [filteredResources]);
  
  // Updated to use directoryResources and new constant name
  const visibleDirectoryResources = isAuthenticated ? directoryResources : directoryResources.slice(0, VISIBLE_RESOURCES_IN_DIRECTORY);
  console.log('[ResourcesPage] Visible Directory Resources (for main tab display):', visibleDirectoryResources);

  const visibleTweets = isAuthenticated ? tweetResources : tweetResources.slice(0, VISIBLE_TWEETS);
  const visibleLinkedIn = isAuthenticated ? linkedinResources : linkedinResources.slice(0, VISIBLE_LINKEDIN);

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setTypeFilter('all');
    setWithDeadline(false);
    console.log('[ResourcesPage] Filters cleared.');
  };

  return (
    <AppLayout fullWidth={true}>
      <div className="space-y-8 w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
          <p className="text-muted-foreground mt-2">
            Discover helpful resources, events, and learning opportunities.
          </p>
        </div>
        
        <Tabs defaultValue="resources" className="space-y-8 w-full">
          <TabsList>
            <TabsTrigger value="resources">Resource Directory</TabsTrigger>
            <TabsTrigger value="tweets">Top Tweets</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn Updates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="resources" className="space-y-6">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search resources..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    <SelectItem value="all">All Categories</SelectItem>
                    {(['Training', 'Event', 'Opportunity', 'Program'] as const).map(staticCat => (
                        <SelectItem key={staticCat} value={normalizeString(staticCat)}>
                            {staticCat}
                        </SelectItem>
                    ))}
                    {uniqueCategories.filter(category => !['Training', 'Event', 'Opportunity', 'Program', 'General'].includes(category)).map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Resource Type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueResourceTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="withDeadline" 
                    checked={withDeadline}
                    onCheckedChange={(checked) => setWithDeadline(!!checked)}
                  />
                  <label
                    htmlFor="withDeadline"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    With deadline
                  </label>
                </div>
                
                {(searchQuery || categoryFilter !== 'all' || typeFilter !== 'all' || withDeadline) && (
                  <Button 
                    variant="ghost" 
                    className="h-8 px-2 lg:px-3" 
                    onClick={clearFilters}
                  >
                    <FilterX className="mr-2 h-4 w-4" />
                    Clear filters
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="text-center py-12">
                  <h3 className="text-xl font-medium mb-2">Loading resources...</h3>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {/* Updated to use visibleDirectoryResources */}
                  {visibleDirectoryResources.map((resource) => (
                    <ResourceCard key={resource.id} resource={resource} />
                  ))}
                  
                  {/* Updated LoginWall logic to use directoryResources */}
                  {!isAuthenticated && directoryResources.length > VISIBLE_RESOURCES_IN_DIRECTORY && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <LoginWall 
                        message={`Unlock all ${directoryResources.length}+ curated resources — log in or create an account to continue exploring.`} 
                        visibleItems={VISIBLE_RESOURCES_IN_DIRECTORY}
                        totalItems={directoryResources.length}
                      />
                    </div>
                  )}
                </div>
              )}
              
              {/* Updated "No resources found" message to use visibleDirectoryResources */}
              {!isLoading && visibleDirectoryResources.length === 0 && (
                <div className="text-center py-12">
                  <h3 className="text-xl font-medium mb-2">No resources found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
                  {console.log('[ResourcesPage] Displaying "No resources found" for Directory Tab. Filters:', { searchQuery, categoryFilter, typeFilter, withDeadline })}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="tweets" className="space-y-6">
            {/* ... keep existing code (Tweets tab content and filters) ... */}
            <div className="max-w-3xl mx-auto">
              {/* Filters for tweets tab - mirroring resource directory for consistency */}
              <div className="flex flex-col space-y-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search top tweets..." 
                      className="pl-10"
                      value={searchQuery} // Uses the same global search query
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {/* Category and Type filters can also apply to tweets if desired, using same state */}
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Resource Type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all">All Types</SelectItem>
                      {uniqueResourceTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="withDeadlineTweets" 
                      checked={withDeadline} // Uses same global deadline state
                      onCheckedChange={(checked) => setWithDeadline(!!checked)}
                    />
                    <label
                      htmlFor="withDeadlineTweets"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      With deadline
                    </label>
                  </div>
                  {(searchQuery || categoryFilter !== 'all' || typeFilter !== 'all' || withDeadline) && (
                    <Button 
                      variant="ghost" 
                      className="h-8 px-2 lg:px-3" 
                      onClick={clearFilters} // Uses same global clear filters
                    >
                      <FilterX className="mr-2 h-4 w-4" />
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>

              {isLoading ? (
                 <div className="text-center py-12">
                   <h3 className="text-xl font-medium mb-2">Loading top tweets...</h3>
                 </div>
              ) : (
                <div className="space-y-4">
                  {visibleTweets.map((resource) => (
                    <TweetCard key={resource.id} tweet={adaptResourceToTweet(resource)} />
                  ))}
                  
                  {!isAuthenticated && tweetResources.length > VISIBLE_TWEETS && tweetResources.length < topGlobalTweets.length && (
                    // Show login wall if unauthenticated AND there are more tweets in the filtered top 100 than shown
                    <div className="relative mt-8">
                      <LoginWall 
                        message={`Sign in to view all ${tweetResources.length} filtered top tweets.`} 
                        visibleItems={VISIBLE_TWEETS}
                        totalItems={tweetResources.length} // Total filtered top tweets
                      />
                    </div>
                  )}
                  {!isAuthenticated && topGlobalTweets.length > VISIBLE_TWEETS && tweetResources.length === topGlobalTweets.length && (
                     // Show login wall if unauthenticated AND all top 100 tweets match filters, but more than VISIBLE_TWEETS
                    <div className="relative mt-8">
                      <LoginWall 
                        message={`Sign in to view all ${topGlobalTweets.length} top tweets.`} 
                        visibleItems={VISIBLE_TWEETS}
                        totalItems={topGlobalTweets.length} // Total top tweets globally
                      />
                    </div>
                  )}
                  
                  {!isLoading && visibleTweets.length === 0 && (
                    <div className="text-center py-12">
                      <h3 className="text-xl font-medium mb-2">No top tweets found</h3>
                      <p className="text-muted-foreground">Try adjusting your search or filter criteria, or check back later for new top tweets.</p>
                      {console.log('[ResourcesPage] Displaying "No top tweets found" for Tweets Tab. Filters:', { searchQuery, categoryFilter, typeFilter, withDeadline })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="linkedin" className="space-y-6">
            {/* ... keep existing code (LinkedIn tab content and filters) ... */}
            <div className="max-w-3xl mx-auto">
               {/* Filters for LinkedIn tab - mirroring resource directory for consistency */}
              <div className="flex flex-col space-y-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search LinkedIn posts..." 
                      className="pl-10"
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Resource Type" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all">All Types</SelectItem>
                      {uniqueResourceTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="withDeadlineLinkedIn" 
                      checked={withDeadline} 
                      onCheckedChange={(checked) => setWithDeadline(!!checked)}
                    />
                    <label
                      htmlFor="withDeadlineLinkedIn"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      With deadline
                    </label>
                  </div>
                  {(searchQuery || categoryFilter !== 'all' || typeFilter !== 'all' || withDeadline) && (
                    <Button 
                      variant="ghost" 
                      className="h-8 px-2 lg:px-3" 
                      onClick={clearFilters}
                    >
                      <FilterX className="mr-2 h-4 w-4" />
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                {visibleLinkedIn.map((resource) => (
                  <LinkedInCard key={resource.id} post={adaptResourceToLinkedIn(resource)} />
                ))}
                
                {!isAuthenticated && linkedinResources.length > VISIBLE_LINKEDIN && (
                  <div className="relative mt-8">
                    <LoginWall 
                      message="Sign in to view more insights from our LinkedIn community." 
                      visibleItems={VISIBLE_LINKEDIN}
                      totalItems={linkedinResources.length}
                    />
                  </div>
                )}
                
                {!isLoading && visibleLinkedIn.length === 0 && (
                  <div className="text-center py-12">
                    <h3 className="text-xl font-medium mb-2">No LinkedIn posts found</h3>
                    <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
                    {console.log('[ResourcesPage] Displaying "No LinkedIn posts found" for LinkedIn Tab. Filters:', { searchQuery, categoryFilter, typeFilter, withDeadline })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <FeedbackSection pagePath="/resources" />
      </div>
    </AppLayout>
  );
};

export default Resources;
