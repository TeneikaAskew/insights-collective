
import { useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ExternalLink, Calendar, FilterX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LoginWall from '@/components/common/LoginWall';
import { Checkbox } from '@/components/ui/checkbox';
import { useResources, Resource, parseArrayField, normalizeString } from '@/hooks/useResources';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { TweetCard } from '@/components/resources/TweetCard';
import { LinkedInCard } from '@/components/resources/LinkedInCard';
import { FeedbackSection } from '@/components/common/FeedbackSection';

const VISIBLE_RESOURCES = 5;
const VISIBLE_TWEETS = 3;
const VISIBLE_LINKEDIN = 3;

// Resource classification helper
const classifyResourceSource = (resource: Resource): 'Tweet' | 'LinkedIn' | 'Standard' => {
  if (resource.tweet_url || (resource.resource_link && resource.resource_link.toLowerCase().includes('twitter.com'))) {
    return 'Tweet';
  } else if (resource.linkedin_url || (resource.resource_link && resource.resource_link.toLowerCase().includes('linkedin.com'))) {
    return 'LinkedIn';
  }
  return 'Standard';
};

// Extract all unique categories from resources
const extractUniqueCategories = (resources: Resource[]): string[] => {
  const categories = new Set<string>();
  
  resources.forEach(resource => {
    // Add the base category
    if (resource.category) {
      categories.add(resource.category);
    }
    
    // Add career_area if present
    if (resource.career_area) {
      categories.add(resource.career_area);
    }
    
    // Parse and add predicted_career_labels
    if (resource.predicted_career_labels) {
      const parsedLabels = parseArrayField(resource.predicted_career_labels);
      parsedLabels.forEach(label => categories.add(label));
    }
  });
  
  return Array.from(categories)
    .filter(Boolean)
    .sort();
};

// Extract all unique resource types from resources
const extractUniqueResourceTypes = (resources: Resource[]): string[] => {
  const types = new Set<string>();
  
  resources.forEach(resource => {
    // Add resource_type if present
    if (resource.resource_type) {
      types.add(resource.resource_type);
    }
    
    // Parse and add predicted_resource_labels
    if (resource.predicted_resource_labels) {
      const parsedLabels = parseArrayField(resource.predicted_resource_labels);
      parsedLabels.forEach(label => types.add(label));
    }
  });
  
  return Array.from(types)
    .filter(Boolean)
    .sort();
};

// Process resources to add computed properties
const processResources = (resources: Resource[]): (Resource & { 
  sourceType: 'Tweet' | 'LinkedIn' | 'Standard', 
  resourceType?: string,
  careerCategory?: string
})[] => {
  return resources.map(resource => {
    const sourceType = classifyResourceSource(resource);
    
    // Extract first resource type for display
    const resourceTypes = [];
    if (resource.resource_type) resourceTypes.push(resource.resource_type);
    if (resource.predicted_resource_labels) {
      resourceTypes.push(...parseArrayField(resource.predicted_resource_labels));
    }
    const resourceType = resourceTypes.length > 0 ? resourceTypes[0] : '';
    
    // Extract first category for display
    const categories = [];
    if (resource.category) categories.push(resource.category);
    if (resource.career_area) categories.push(resource.career_area);
    if (resource.predicted_career_labels) {
      categories.push(...parseArrayField(resource.predicted_career_labels));
    }
    const careerCategory = categories.length > 0 ? categories[0] : '';
    
    return {
      ...resource,
      sourceType,
      resourceType,
      careerCategory
    };
  });
};

// Match resource against search query and filters
const matchesFilters = (
  resource: Resource, 
  searchQuery: string, 
  categoryFilter: string,
  typeFilter: string,
  withDeadline: boolean
): boolean => {
  // Safe text search
  const searchText = searchQuery.toLowerCase();
  const fullText = resource.full_text?.toLowerCase() || '';
  const resourceType = resource.resource_type?.toLowerCase() || '';
  const predictedLabels = resource.predicted_resource_labels?.toLowerCase() || '';
  const careerArea = resource.career_area?.toLowerCase() || '';
  const predictedCareerLabels = resource.predicted_career_labels?.toLowerCase() || '';
  const category = resource.category?.toLowerCase() || '';
  
  // Search matching
  const matchesSearch = 
    searchQuery === '' || 
    fullText.includes(searchText) || 
    resourceType.includes(searchText) || 
    predictedLabels.includes(searchText) ||
    careerArea.includes(searchText) ||
    predictedCareerLabels.includes(searchText) ||
    category.includes(searchText);
  
  // Category matching
  const categoryMatches = () => {
    if (categoryFilter === 'all') return true;
    
    // Check base category
    if (resource.category?.toLowerCase() === categoryFilter.toLowerCase()) {
      return true;
    }
    
    // Check career_area
    if (resource.career_area?.toLowerCase() === categoryFilter.toLowerCase()) {
      return true;
    }
    
    // Check in predicted career labels
    if (resource.predicted_career_labels) {
      const parsedLabels = parseArrayField(resource.predicted_career_labels);
      return parsedLabels.some(label => 
        label.toLowerCase() === categoryFilter.toLowerCase()
      );
    }
    
    return false;
  };
  
  // Resource type matching
  const typeMatches = () => {
    if (typeFilter === 'all') return true;
    
    // Check resource_type
    if (resource.resource_type?.toLowerCase() === typeFilter.toLowerCase()) {
      return true;
    }
    
    // Check in predicted resource labels
    if (resource.predicted_resource_labels) {
      const parsedLabels = parseArrayField(resource.predicted_resource_labels);
      return parsedLabels.some(label => 
        label.toLowerCase() === typeFilter.toLowerCase()
      );
    }
    
    return false;
  };
  
  // Deadline matching
  const deadlineMatches = withDeadline ? resource.deadline !== null : true;
  
  return matchesSearch && categoryMatches() && typeMatches() && deadlineMatches;
};

// Adapt resource for tweet display
const adaptResourceToTweet = (resource: Resource) => {
  return {
    id: resource.id,
    content: resource.full_text || '',
    date: resource.created_at || '',
    url: resource.tweet_url || resource.resource_link || '',
    likes: resource.favorite_count || resource.tweet_likes || 0,
    retweets: resource.retweet_count || resource.tweet_retweets || 0
  };
};

// Adapt resource for LinkedIn display
const adaptResourceToLinkedIn = (resource: Resource) => {
  // Extract and normalize resource types for the title
  const resourceTypes = [];
  if (resource.resource_type) resourceTypes.push(resource.resource_type);
  if (resource.predicted_resource_labels) {
    resourceTypes.push(...parseArrayField(resource.predicted_resource_labels));
  }
  
  const title = resourceTypes.length > 0 
    ? normalizeString(resourceTypes[0]) 
    : 'Resource';
  
  return {
    id: resource.id,
    title,
    description: resource.full_text || '',
    date: resource.created_at || '',
    url: resource.linkedin_url || resource.resource_link || ''
  };
};

const Resources = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [withDeadline, setWithDeadline] = useState(false);
  const { isAuthenticated } = useAuth();
  const { resources, isLoading } = useResources();
  
  // Process resources with source classification and computed properties
  const processedResources = useMemo(() => {
    return processResources(resources);
  }, [resources]);
  
  // Extract all unique normalized categories for filtering
  const uniqueCategories = useMemo(() => {
    return extractUniqueCategories(resources).map(normalizeString);
  }, [resources]);
  
  // Extract all unique normalized resource types for filtering
  const uniqueResourceTypes = useMemo(() => {
    return extractUniqueResourceTypes(resources).map(normalizeString);
  }, [resources]);
  
  // Filter resources based on search and filters
  const filteredResources = useMemo(() => {
    return processedResources.filter(resource => 
      matchesFilters(
        resource, 
        searchQuery, 
        categoryFilter, 
        typeFilter, 
        withDeadline
      )
    );
  }, [processedResources, searchQuery, categoryFilter, typeFilter, withDeadline]);
  
  // Split resources by type
  const standardResources = filteredResources.filter(r => r.sourceType === 'Standard');
  const tweetResources = filteredResources.filter(r => r.sourceType === 'Tweet');
  const linkedinResources = filteredResources.filter(r => r.sourceType === 'LinkedIn');
  
  // Limit resources based on authentication
  const visibleStandardResources = isAuthenticated ? standardResources : standardResources.slice(0, VISIBLE_RESOURCES);
  const visibleTweets = isAuthenticated ? tweetResources : tweetResources.slice(0, VISIBLE_TWEETS);
  const visibleLinkedIn = isAuthenticated ? linkedinResources : linkedinResources.slice(0, VISIBLE_LINKEDIN);

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setTypeFilter('all');
    setWithDeadline(false);
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
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="event">Events</SelectItem>
                    <SelectItem value="opportunity">Opportunities</SelectItem>
                    <SelectItem value="program">Programs</SelectItem>
                    {uniqueCategories.map((category) => (
                      category.toLowerCase() !== 'training' &&
                      category.toLowerCase() !== 'event' &&
                      category.toLowerCase() !== 'opportunity' &&
                      category.toLowerCase() !== 'program' &&
                      category.toLowerCase() !== 'general' && (
                        <SelectItem key={category} value={category.toLowerCase()}>
                          {category}
                        </SelectItem>
                      )
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
                      <SelectItem key={type} value={type.toLowerCase()}>
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
                  {visibleStandardResources.map((resource) => (
                    <ResourceCard key={resource.id} resource={resource} />
                  ))}
                  
                  {!isAuthenticated && standardResources.length > VISIBLE_RESOURCES && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <LoginWall 
                        message={`Unlock all ${standardResources.length}+ curated resources — log in or create an account to continue exploring.`} 
                        visibleItems={VISIBLE_RESOURCES}
                        totalItems={standardResources.length}
                      />
                    </div>
                  )}
                </div>
              )}
              
              {!isLoading && visibleStandardResources.length === 0 && (
                <div className="text-center py-12">
                  <h3 className="text-xl font-medium mb-2">No resources found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="tweets" className="space-y-6">
            <div className="max-w-3xl mx-auto">
              <div className="space-y-4">
                {visibleTweets.map((resource) => (
                  <TweetCard key={resource.id} tweet={adaptResourceToTweet(resource)} />
                ))}
                
                {!isAuthenticated && tweetResources.length > VISIBLE_TWEETS && (
                  <div className="relative mt-8">
                    <LoginWall 
                      message="Sign in to view more curated insights from the IC community." 
                      visibleItems={VISIBLE_TWEETS}
                      totalItems={tweetResources.length}
                    />
                  </div>
                )}
                
                {!isLoading && visibleTweets.length === 0 && (
                  <div className="text-center py-12">
                    <h3 className="text-xl font-medium mb-2">No tweets found</h3>
                    <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="linkedin" className="space-y-6">
            <div className="max-w-3xl mx-auto">
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
