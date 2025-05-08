
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
import { useResources, Resource } from '@/hooks/useResources';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { TweetCard } from '@/components/resources/TweetCard';
import { LinkedInCard } from '@/components/resources/LinkedInCard';
import { FeedbackSection } from '@/components/common/FeedbackSection';

const VISIBLE_RESOURCES = 5;
const VISIBLE_TWEETS = 3;
const VISIBLE_LINKEDIN = 3;

// Resource classification helper
const classifyResourceSource = (resource: Resource): 'Tweet' | 'LinkedIn' | 'Standard' => {
  if (resource.tweet_url || (resource.resource_link && resource.resource_link.includes('twitter.com'))) {
    return 'Tweet';
  } else if (resource.linkedin_url || (resource.resource_link && resource.resource_link.includes('linkedin.com'))) {
    return 'LinkedIn';
  }
  return 'Standard';
};

// Resource type helper
const getResourceType = (resource: Resource): string => {
  if (resource.resource_type) {
    return resource.resource_type;
  }
  if (resource.predicted_resource_labels) {
    return resource.predicted_resource_labels.split(',')[0]?.trim() || 'Other';
  }
  return resource.category || 'Other';
};

// Career category helper
const getCareerCategory = (resource: Resource): string => {
  if (resource.career_area) {
    return resource.career_area;
  }
  if (resource.predicted_career_labels) {
    return resource.predicted_career_labels.split(',')[0]?.trim() || 'General';
  }
  return resource.category || 'General';
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
  return {
    id: resource.id,
    title: getResourceType(resource),
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
  
  // Process and categorize resources based on source
  const processedResources = useMemo(() => {
    return resources.map((resource: Resource) => ({
      ...resource,
      sourceType: classifyResourceSource(resource),
      resourceType: getResourceType(resource),
      careerCategory: getCareerCategory(resource)
    }));
  }, [resources]);
  
  // Extract unique resource types for the dropdown filter
  const uniqueResourceTypes = useMemo(() => {
    const types = new Set<string>();
    processedResources.forEach(resource => {
      if (resource.resourceType && resource.resourceType.trim() !== '') {
        types.add(resource.resourceType);
      }
    });
    return Array.from(types).sort();
  }, [processedResources]);
  
  const filteredResources = processedResources.filter((resource) => {
    // Handle search query with null/undefined checks
    const matchesSearch = 
      ((resource.full_text || '')?.toLowerCase().includes(searchQuery.toLowerCase())) || 
      ((resource.resourceType || '')?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      ((resource.careerCategory || '')?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Handle category filter
    const matchesCategory = categoryFilter === 'all' || resource.category === categoryFilter;
    
    // Handle resource type filter
    const matchesType = typeFilter === 'all' || resource.resourceType === typeFilter;
    
    // Handle deadline filter
    const matchesDeadline = withDeadline ? resource.deadline !== null : true;
    
    return matchesSearch && matchesCategory && matchesType && matchesDeadline;
  });
  
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
          <p className="text-muted-foreground mt-2">
            Discover helpful resources, events, and learning opportunities.
          </p>
        </div>
        
        <Tabs defaultValue="resources" className="space-y-8">
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
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="event">Events</SelectItem>
                    <SelectItem value="opportunity">Opportunities</SelectItem>
                    <SelectItem value="program">Programs</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Resource Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueResourceTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
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
