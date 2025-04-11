import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Video, BookOpen, Link as LinkIcon, Layout, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AddResourceModal } from '@/components/resources/AddResourceModal';

const mockResources = [
  {
    id: '1',
    title: 'Data Science Handbook',
    description: 'A comprehensive guide to data science, covering everything from statistics to machine learning.',
    type: 'guide',
    url: 'https://example.com/data-science-handbook',
    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: '2',
    title: 'Introduction to Machine Learning',
    description: 'A video series that introduces the basic concepts of machine learning.',
    type: 'video',
    url: 'https://example.com/introduction-to-machine-learning',
    thumbnail: 'https://img.youtube.com/vi/nKW8Ndu7Mjw/0.jpg',
  },
  {
    id: '3',
    title: 'Data Visualization with Python',
    description: 'An article that shows how to create data visualizations with Python.',
    type: 'article',
    url: 'https://example.com/data-visualization-with-python',
    thumbnail: 'https://images.unsplash.com/photo-1505773531345-33904b579862?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZGF0YSUyMHZpc3VhbGl6YXRpb258ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60',
  },
  {
    id: '4',
    title: 'SQL for Data Analysis',
    description: 'A guide that teaches how to use SQL for data analysis.',
    type: 'guide',
    url: 'https://example.com/sql-for-data-analysis',
    thumbnail: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8c3FsfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60',
  },
  {
    id: '5',
    title: 'The Ultimate Guide to Data Engineering',
    description: 'A comprehensive guide to data engineering, covering everything from data ingestion to data warehousing.',
    type: 'guide',
    url: 'https://example.com/the-ultimate-guide-to-data-engineering',
    thumbnail: 'https://images.unsplash.com/photo-1542744166-e35939358f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGRhdGElMjBlbmdpbmVlcmluZ3xlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60',
  },
  {
    id: '6',
    title: 'Data Science Interview Questions',
    description: 'A video that covers the most common data science interview questions.',
    type: 'video',
    url: 'https://example.com/data-science-interview-questions',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg',
  },
  {
    id: '7',
    title: 'Data Ethics: Building Responsible AI Systems',
    description: 'An article that discusses the ethical considerations in AI development and how to build responsible systems.',
    type: 'article',
    url: 'https://example.com/data-ethics-building-responsible-ai-systems',
    thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: '8',
    title: 'Building a Data-Driven Culture in Your Organization',
    description: 'An article that provides strategies for establishing a data-driven culture in your organization.',
    type: 'article',
    url: 'https://example.com/building-a-data-driven-culture-in-your-organization',
    thumbnail: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
  },
];

const Resources = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [resources, setResources] = useState(mockResources);
  const { isAuthenticated } = useAuth();
  
  const handleAddResource = (newResource: any) => {
    setResources([...resources, newResource]);
  };
  
  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || resource.type === typeFilter;
    
    return matchesSearch && matchesType;
  });
  
  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
            <p className="text-muted-foreground">
              Access learning materials, guides, and other resources to support your data journey.
            </p>
          </div>
          
          {isAuthenticated && (
            <AddResourceModal onAddResource={handleAddResource} />
          )}
        </div>
        
        <Card className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border-0">
          <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="md:w-2/3 space-y-4">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors">
                Featured Series
              </Badge>
              <h2 className="text-2xl font-bold">Data Blueprint Blog Series</h2>
              <p className="text-muted-foreground">
                Explore our collection of articles, tutorials, and insights from data experts. Learn best practices, emerging trends, and practical techniques to enhance your data skills.
              </p>
              <Button asChild>
                <Link to="/data-blueprint">View Data Blueprint Series</Link>
              </Button>
            </div>
            
            <div className="md:w-1/3 flex justify-center">
              <Layout className="h-32 w-32 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                <TabsTrigger value="article" className="flex-1">Articles</TabsTrigger>
                <TabsTrigger value="video" className="flex-1">Videos</TabsTrigger>
                <TabsTrigger value="guide" className="flex-1">Guides</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredResources.map((resource) => (
            <Card key={resource.id} className="overflow-hidden">
              <div className="aspect-video w-full overflow-hidden">
                <img 
                  src={resource.thumbnail} 
                  alt={resource.title} 
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-5 space-y-3">
                <h3 className="text-lg font-semibold line-clamp-2">{resource.title}</h3>
                <p className="text-muted-foreground text-sm line-clamp-2">{resource.description}</p>
                <Button variant="link" className="w-full justify-start" asChild>
                  <Link to={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    View Resource
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Resources;
