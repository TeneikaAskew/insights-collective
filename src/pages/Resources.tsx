
import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ExternalLink, Calendar, Twitter } from 'lucide-react';

// Mock resource data
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

// Mock tweets
const mockTweets = [
  {
    id: '1',
    content: 'Excited to announce our new Data Science course! Join us to learn the fundamentals of data analysis, machine learning, and more. #DataScience #Learning',
    date: '2025-04-02T14:30:00Z',
    likes: 124,
    retweets: 45,
  },
  {
    id: '2',
    content: 'Just published a new guide on advanced ML techniques. Check it out on our resources page! #MachineLearning #AI',
    date: '2025-04-01T10:15:00Z',
    likes: 87,
    retweets: 32,
  },
  {
    id: '3',
    content: 'Registration for our summer analytics bootcamp is now open! Limited spots available. #Analytics #DataSkills',
    date: '2025-03-28T09:45:00Z',
    likes: 156,
    retweets: 67,
  },
];

type ResourceProps = {
  id: string;
  name: string;
  description: string;
  category: string;
  link: string;
  deadline: string | null;
};

const ResourceCard = ({ resource }: { resource: ResourceProps }) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{resource.name}</CardTitle>
            <CardDescription className="mt-2">{resource.description}</CardDescription>
          </div>
          <Badge variant="outline" className="capitalize">
            {resource.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {resource.deadline && (
          <div className="flex items-center text-sm text-muted-foreground mb-4">
            <Calendar className="h-4 w-4 mr-2" />
            <span>Deadline: {formatDate(resource.deadline)}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" asChild>
          <a href={resource.link} target="_blank" rel="noopener noreferrer" className="flex items-center">
            Visit Resource
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
};

const TweetCard = ({ tweet }: { tweet: any }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Twitter className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">Insights Collective</span>
              <span className="text-sm text-muted-foreground">@InsightsCol</span>
              <span className="text-sm text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">{formatDate(tweet.date)}</span>
            </div>
            <p className="text-sm mb-4">{tweet.content}</p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>
                <span>{tweet.likes}</span>
              </div>
              <div className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-repeat"><path d="m17 2 4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="m7 22-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path></svg>
                <span>{tweet.retweets}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Resources = () => {
  const [resources, setResources] = useState<ResourceProps[]>(mockResources);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const filteredResources = resources.filter((resource) => {
    const matchesSearch = resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || resource.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
  
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
          </TabsList>
          
          <TabsContent value="resources" className="space-y-6">
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
            
            {filteredResources.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredResources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <h3 className="text-xl font-medium mb-2">No resources found</h3>
                <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="tweets" className="space-y-6">
            <div className="max-w-3xl mx-auto">
              <div className="space-y-4">
                {mockTweets.map((tweet) => (
                  <TweetCard key={tweet.id} tweet={tweet} />
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Resources;
