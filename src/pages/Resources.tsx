import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ExternalLink, Calendar, Twitter, FilterX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LoginWall from '@/components/common/LoginWall';
import { Checkbox } from '@/components/ui/checkbox';
import { useResources, Resource } from '@/hooks/useResources';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { TweetCard } from '@/components/resources/TweetCard';
import { LinkedInCard } from '@/components/resources/LinkedInCard';

const mockResources = [
  {
    id: '1',
    name: 'Introduction to Data Science',
    description: 'A comprehensive beginner guide to data science fundamentals.',
    category: 'training',
    link: 'https://example.com/data-science',
    deadline: '2025-05-30',
  },
  {
    id: '2',
    name: 'Machine Learning Conference 2025',
    description: 'Annual conference showcasing the latest in ML research and applications.',
    category: 'event',
    link: 'https://example.com/ml-conference',
    deadline: '2025-06-15',
  },
  {
    id: '3',
    name: 'AI Research Fellowship',
    description: 'Apply for a 6-month fellowship to work on cutting-edge AI projects.',
    category: 'opportunity',
    link: 'https://example.com/ai-fellowship',
    deadline: '2025-04-30',
  },
  {
    id: '4',
    name: 'Data Engineering Bootcamp',
    description: 'Intensive 8-week program on data engineering best practices.',
    category: 'training',
    link: 'https://example.com/data-engineering',
    deadline: '2025-05-10',
  },
  {
    id: '5',
    name: 'Analytics Certification Program',
    description: 'Get certified in advanced analytics techniques and tools.',
    category: 'program',
    link: 'https://example.com/analytics-cert',
    deadline: null,
  },
];

const additionalResources = [
  {
    id: '6',
    name: 'Advanced Python for Data Scientists',
    description: 'Masterclass on Python optimization, parallel processing, and advanced data structures for handling large-scale datasets.',
    category: 'training',
    link: 'https://example.com/advanced-python',
    deadline: '2025-07-15',
  },
  {
    id: '7',
    name: 'Data Science Grant Application',
    description: 'Apply for funding to research novel machine learning approaches to climate prediction models.',
    category: 'opportunity',
    link: 'https://example.com/ds-grant',
    deadline: '2025-05-20',
  },
  {
    id: '8',
    name: 'Natural Language Processing Workshop',
    description: 'Hands-on workshop on transformer models, sequence-to-sequence learning, and production NLP systems.',
    category: 'event',
    link: 'https://example.com/nlp-workshop',
    deadline: '2025-06-01',
  },
  {
    id: '9',
    name: 'Data Visualization Best Practices',
    description: 'Learn how to create compelling, informative visualizations that effectively communicate insights.',
    category: 'training',
    link: 'https://example.com/data-viz',
    deadline: null,
  },
  {
    id: '10',
    name: 'MLOps Conference 2025',
    description: 'Conference dedicated to machine learning operations, monitoring, and deployment strategies.',
    category: 'event',
    link: 'https://example.com/mlops-conf',
    deadline: '2025-07-10',
  },
];

const mockTweets = [
  {
    id: '1',
    content: 'Just released our updated Data Science curriculum! New modules on deep learning and reinforcement learning now available. #DataScience #AI',
    date: '2025-04-01T10:15:00Z',
    likes: 156,
    retweets: 42,
  },
  {
    id: '2',
    content: 'Registration for our summer data science bootcamp is now open! Limited spots available. Apply today! #DataBootcamp #SummerLearning',
    date: '2025-03-28T14:30:00Z',
    likes: 98,
    retweets: 35,
  },
  {
    id: '3',
    content: 'Check out our latest blog post: "10 Essential Skills for Data Scientists in 2025" - featuring insights from industry leaders. #CareerAdvice #DataScience',
    date: '2025-03-26T09:45:00Z',
    likes: 124,
    retweets: 51,
  },
];

const additionalTweets = [
  {
    id: '4',
    content: 'Our newest course on GANs and diffusion models is now open for enrollment! Limited spots available. #GenerativeAI #DeepLearning',
    date: '2025-03-25T11:30:00Z',
    likes: 203,
    retweets: 89,
  },
  {
    id: '5',
    content: 'Excited to announce our partnership with leading tech companies to provide internship opportunities for our top students! #Careers #DataScience',
    date: '2025-03-22T15:45:00Z',
    likes: 178,
    retweets: 56,
  },
  {
    id: '6',
    content: 'Registration for our annual data hackathon is now open! Join us for 48 hours of innovation, collaboration, and prizes! #Hackathon #DataInnovation',
    date: '2025-03-20T13:20:00Z',
    likes: 145,
    retweets: 78,
  },
];

const mockLinkedInPosts = [
  {
    id: '1',
    title: 'Data Science Career Paths',
    description: 'Looking to start your journey in data science? Check out our comprehensive guide to different career paths and opportunities in the field.',
    date: '2025-04-01T10:00:00Z',
    url: 'https://linkedin.com/post/1',
  },
  {
    id: '2',
    title: 'AI Workshop Announcement',
    description: 'Join us for an exciting workshop on practical applications of AI in business. Limited spots available!',
    date: '2025-03-28T14:00:00Z',
    url: 'https://linkedin.com/post/2',
  },
];

const allResources = [...mockResources, ...additionalResources];
const allTweets = [...mockTweets, ...additionalTweets];

const VISIBLE_RESOURCES = 5;
const VISIBLE_TWEETS = 3;

const Resources = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [withDeadline, setWithDeadline] = useState(false);
  const { isAuthenticated } = useAuth();
  const { resources, isLoading } = useResources();
  
  const filteredResources = resources.filter((resource: Resource) => {
    const matchesSearch = resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || resource.category === categoryFilter;
    
    const matchesDeadline = withDeadline ? resource.deadline !== null : true;
    
    return matchesSearch && matchesCategory && matchesDeadline;
  });
  
  const visibleResources = isAuthenticated ? filteredResources : filteredResources.slice(0, VISIBLE_RESOURCES);
  const visibleTweets = isAuthenticated ? allTweets : allTweets.slice(0, VISIBLE_TWEETS);

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setWithDeadline(false);
  };

  return (
    <AppLayout>
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
                
                {(searchQuery || categoryFilter !== 'all' || withDeadline) && (
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

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {visibleResources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
                
                {!isAuthenticated && filteredResources.length > VISIBLE_RESOURCES && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <LoginWall 
                      message="Unlock all 40+ curated resources — log in or create an account to continue exploring." 
                      visibleItems={VISIBLE_RESOURCES}
                      totalItems={filteredResources.length}
                    />
                  </div>
                )}
              </div>
              
              {visibleResources.length === 0 && (
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
                {visibleTweets.map((tweet) => (
                  <TweetCard key={tweet.id} tweet={tweet} />
                ))}
                
                {!isAuthenticated && allTweets.length > VISIBLE_TWEETS && (
                  <div className="relative mt-8">
                    <LoginWall 
                      message="Sign in to view more curated insights from the IC community." 
                      visibleItems={VISIBLE_TWEETS}
                      totalItems={allTweets.length}
                    />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="linkedin" className="space-y-6">
            <div className="max-w-3xl mx-auto">
              <div className="space-y-4">
                {mockLinkedInPosts.map((post) => (
                  <LinkedInCard key={post.id} post={post} />
                ))}
                
                {!isAuthenticated && mockLinkedInPosts.length > VISIBLE_RESOURCES && (
                  <div className="relative mt-8">
                    <LoginWall 
                      message="Sign in to view more insights from our LinkedIn community." 
                      visibleItems={VISIBLE_RESOURCES}
                      totalItems={mockLinkedInPosts.length}
                    />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Resources;
