
import React, { useState } from 'react';
import { SearchIcon, FileIcon, FolderIcon, BookIcon, VideoIcon, LinkIcon, CalendarIcon } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AddResourceModal } from '@/components/resources/AddResourceModal';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

// Mock data
const mockResources = [
  {
    id: '1',
    title: 'Introduction to Data Science',
    description: 'A comprehensive guide to getting started with data science.',
    type: 'document',
    format: 'PDF',
    category: 'Fundamentals',
    url: '#',
    publishDate: '2025-02-15',
    deadline: '2025-05-15',
    author: 'Data Science Team',
  },
  {
    id: '2',
    title: 'Python for Data Analysis',
    description: 'Learn how to use Python for effective data analysis.',
    type: 'video',
    format: 'MP4',
    category: 'Programming',
    url: '#',
    publishDate: '2025-03-01',
    deadline: null,
    author: 'John Smith',
  },
  {
    id: '3',
    title: 'SQL Fundamentals Cheat Sheet',
    description: 'A quick reference guide for SQL syntax and commands.',
    type: 'document',
    format: 'PDF',
    category: 'Databases',
    url: '#',
    publishDate: '2025-03-10',
    deadline: '2025-04-20',
    author: 'Database Team',
  },
  {
    id: '4',
    title: 'Data Visualization Best Practices',
    description: 'Learn how to create effective and engaging data visualizations.',
    type: 'article',
    format: 'Web',
    category: 'Visualization',
    url: '#',
    publishDate: '2025-03-15',
    deadline: null,
    author: 'Jane Doe',
  },
  {
    id: '5',
    title: 'Machine Learning Model Deployment',
    description: 'A step-by-step guide to deploying ML models in production.',
    type: 'video',
    format: 'MP4',
    category: 'Machine Learning',
    url: '#',
    publishDate: '2025-03-20',
    deadline: '2025-05-01',
    author: 'ML Engineering Team',
  },
  {
    id: '6',
    title: 'Data Ethics and Privacy',
    description: 'Understanding the ethical implications of data collection and use.',
    type: 'course',
    format: 'Interactive',
    category: 'Ethics',
    url: '#',
    publishDate: '2025-04-01',
    deadline: null,
    author: 'Ethics Committee',
  },
  {
    id: '7',
    title: 'Big Data Technologies Overview',
    description: 'An introduction to Hadoop, Spark, and other big data tools.',
    type: 'document',
    format: 'PDF',
    category: 'Big Data',
    url: '#',
    publishDate: '2025-04-05',
    deadline: '2025-06-01',
    author: 'Data Engineering Team',
  },
  {
    id: '8',
    title: 'Natural Language Processing Workshop',
    description: 'Hands-on workshop for NLP techniques and applications.',
    type: 'workshop',
    format: 'Interactive',
    category: 'NLP',
    url: '#',
    publishDate: '2025-04-10',
    deadline: '2025-05-10',
    author: 'AI Research Team',
  },
];

// Resource type to icon mapping
const resourceTypeIcons = {
  document: <FileIcon className="h-4 w-4" />,
  folder: <FolderIcon className="h-4 w-4" />,
  article: <BookIcon className="h-4 w-4" />,
  video: <VideoIcon className="h-4 w-4" />,
  course: <BookIcon className="h-4 w-4" />,
  link: <LinkIcon className="h-4 w-4" />,
  workshop: <CalendarIcon className="h-4 w-4" />,
};

// Resource type colors
const resourceTypeColors = {
  document: 'bg-blue-100 text-blue-800',
  folder: 'bg-gray-100 text-gray-800',
  article: 'bg-green-100 text-green-800',
  video: 'bg-red-100 text-red-800',
  course: 'bg-purple-100 text-purple-800',
  link: 'bg-yellow-100 text-yellow-800',
  workshop: 'bg-indigo-100 text-indigo-800',
};

const ResourcesPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [hasDeadlineFilter, setHasDeadlineFilter] = useState(false);
  
  // Extract unique categories
  const categories = ['all', ...new Set(mockResources.map(r => r.category))];
  
  // Extract unique types
  const types = ['all', ...new Set(mockResources.map(r => r.type))];
  
  // Filter resources based on search and filters
  const filteredResources = mockResources.filter(resource => {
    const matchesSearch = 
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || resource.category === categoryFilter;
    const matchesType = typeFilter === 'all' || resource.type === typeFilter;
    const matchesDeadline = hasDeadlineFilter ? resource.deadline !== null : true;
    
    return matchesSearch && matchesCategory && matchesType && matchesDeadline;
  });
  
  // Sort resources by publish date (newest first)
  const sortedResources = [...filteredResources].sort((a, b) => {
    return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
  });
  
  const handleAddResource = (resourceData) => {
    console.log('Resource added:', resourceData);
    // In a real app, this would add the resource to the database
  };
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
            <p className="text-muted-foreground mt-2">
              Access learning materials, templates, and guides to support your data journey.
            </p>
          </div>
          
          {isAdmin && (
            <AddResourceModal onAddResource={handleAddResource}>
              <Button>Add Resource</Button>
            </AddResourceModal>
          )}
        </div>
        
        <div>
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle>Featured Series</CardTitle>
              <CardDescription>
                Curated learning pathways for comprehensive skill development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Data Blueprint Series</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Foundational knowledge for aspiring data professionals.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/resources/data-blueprint">Explore Series</Link>
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">ML Engineering Path</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Advanced resources for machine learning deployment.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="#">Explore Series</Link>
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Data Visualization Mastery</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Techniques for creating impactful data stories.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="#">Explore Series</Link>
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </CardContent>
          </Card>
          
          <Tabs defaultValue="all" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <TabsList className="md:flex-shrink-0">
                <TabsTrigger value="all">All Resources</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="videos">Videos</TabsTrigger>
                <TabsTrigger value="interactive">Interactive</TabsTrigger>
              </TabsList>
              
              <div className="flex flex-1 flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category === 'all' ? 'All Categories' : category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="hasDeadline" 
                    checked={hasDeadlineFilter}
                    onCheckedChange={setHasDeadlineFilter}
                  />
                  <label
                    htmlFor="hasDeadline"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Has Deadline
                  </label>
                </div>
              </div>
            </div>
            
            <TabsContent value="all" className="mt-0">
              {sortedResources.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sortedResources.map((resource) => (
                    <Card key={resource.id}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{resource.title}</CardTitle>
                          <Badge variant="outline" className={resourceTypeColors[resource.type]}>
                            <span className="flex items-center gap-1">
                              {resourceTypeIcons[resource.type]}
                              {resource.type.charAt(0).toUpperCase() + resource.type.slice(1)}
                            </span>
                          </Badge>
                        </div>
                        <CardDescription>{resource.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Format:</span>
                            <span>{resource.format}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Category:</span>
                            <span>{resource.category}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Published:</span>
                            <span>{new Date(resource.publishDate).toLocaleDateString()}</span>
                          </div>
                          {resource.deadline && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Deadline:</span>
                              <span className="text-rose-600 font-medium">{new Date(resource.deadline).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button variant="outline" className="w-full" asChild>
                          <a href={resource.url} target="_blank" rel="noopener noreferrer">
                            Access Resource
                          </a>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">No resources found</h3>
                  <p className="mt-2 text-muted-foreground">
                    Try adjusting your search or filters to find what you're looking for.
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="documents" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedResources.filter(r => r.type === 'document' || r.type === 'article').map((resource) => (
                  <Card key={resource.id}>
                    {/* Same card content as above */}
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{resource.title}</CardTitle>
                        <Badge variant="outline" className={resourceTypeColors[resource.type]}>
                          <span className="flex items-center gap-1">
                            {resourceTypeIcons[resource.type]}
                            {resource.type.charAt(0).toUpperCase() + resource.type.slice(1)}
                          </span>
                        </Badge>
                      </div>
                      <CardDescription>{resource.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Format:</span>
                          <span>{resource.format}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category:</span>
                          <span>{resource.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Published:</span>
                          <span>{new Date(resource.publishDate).toLocaleDateString()}</span>
                        </div>
                        {resource.deadline && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Deadline:</span>
                            <span className="text-rose-600 font-medium">{new Date(resource.deadline).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" className="w-full" asChild>
                        <a href={resource.url} target="_blank" rel="noopener noreferrer">
                          Access Resource
                        </a>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="videos" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedResources.filter(r => r.type === 'video').map((resource) => (
                  <Card key={resource.id}>
                    {/* Same card content as above */}
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{resource.title}</CardTitle>
                        <Badge variant="outline" className={resourceTypeColors[resource.type]}>
                          <span className="flex items-center gap-1">
                            {resourceTypeIcons[resource.type]}
                            {resource.type.charAt(0).toUpperCase() + resource.type.slice(1)}
                          </span>
                        </Badge>
                      </div>
                      <CardDescription>{resource.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Format:</span>
                          <span>{resource.format}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category:</span>
                          <span>{resource.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Published:</span>
                          <span>{new Date(resource.publishDate).toLocaleDateString()}</span>
                        </div>
                        {resource.deadline && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Deadline:</span>
                            <span className="text-rose-600 font-medium">{new Date(resource.deadline).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" className="w-full" asChild>
                        <a href={resource.url} target="_blank" rel="noopener noreferrer">
                          Access Resource
                        </a>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="interactive" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedResources.filter(r => r.type === 'course' || r.type === 'workshop').map((resource) => (
                  <Card key={resource.id}>
                    {/* Same card content as above */}
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{resource.title}</CardTitle>
                        <Badge variant="outline" className={resourceTypeColors[resource.type]}>
                          <span className="flex items-center gap-1">
                            {resourceTypeIcons[resource.type]}
                            {resource.type.charAt(0).toUpperCase() + resource.type.slice(1)}
                          </span>
                        </Badge>
                      </div>
                      <CardDescription>{resource.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Format:</span>
                          <span>{resource.format}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category:</span>
                          <span>{resource.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Published:</span>
                          <span>{new Date(resource.publishDate).toLocaleDateString()}</span>
                        </div>
                        {resource.deadline && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Deadline:</span>
                            <span className="text-rose-600 font-medium">{new Date(resource.deadline).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" className="w-full" asChild>
                        <a href={resource.url} target="_blank" rel="noopener noreferrer">
                          Access Resource
                        </a>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default ResourcesPage;
