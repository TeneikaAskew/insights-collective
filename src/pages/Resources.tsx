
import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, FileText, Link, Calendar, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AddResourceModal from '@/components/resources/AddResourceModal';
import { useAuth } from '@/contexts/AuthContext';

const resources = [
  {
    id: 1,
    title: 'Introduction to Data Visualization',
    description: 'Learn the basics of data visualization techniques using various tools.',
    type: 'article',
    url: '#',
    deadline: new Date('2023-05-15'),
    hasDeadline: true,
    tags: ['visualization', 'beginner'],
  },
  {
    id: 2,
    title: 'Advanced SQL for Data Analysis',
    description: 'Master complex SQL queries and optimize database performance for data analysis.',
    type: 'document',
    url: '#',
    deadline: null,
    hasDeadline: false,
    tags: ['sql', 'database', 'advanced'],
  },
  {
    id: 3,
    title: 'Machine Learning Project Guidelines',
    description: 'A comprehensive guide to structuring and implementing machine learning projects.',
    type: 'document',
    url: '#',
    deadline: new Date('2023-06-01'),
    hasDeadline: true,
    tags: ['machine learning', 'project management'],
  },
  {
    id: 4,
    title: 'Python Data Processing Libraries Comparison',
    description: 'A comparative analysis of popular Python libraries for data processing.',
    type: 'article',
    url: '#',
    deadline: null,
    hasDeadline: false,
    tags: ['python', 'data processing'],
  },
  {
    id: 5,
    title: 'Data Ethics in AI Development',
    description: 'Ethical considerations and best practices for responsible AI development.',
    type: 'link',
    url: 'https://example.com/data-ethics',
    deadline: null,
    hasDeadline: false,
    tags: ['ethics', 'AI'],
  },
];

const blueprintResources = [
  {
    id: 101,
    title: 'Data Blueprint Series: Introduction',
    description: 'An overview of the Data Blueprint methodology for data-driven organizations.',
    type: 'document',
    url: '#',
    deadline: null,
    hasDeadline: false,
    tags: ['blueprint', 'methodology'],
  },
  {
    id: 102,
    title: 'Data Blueprint Series: Assessment Framework',
    description: 'Tools and templates for assessing current data capabilities.',
    type: 'document',
    url: '#',
    deadline: null,
    hasDeadline: false,
    tags: ['blueprint', 'assessment'],
  },
  {
    id: 103,
    title: 'Data Blueprint Series: Implementation Guide',
    description: 'Step-by-step guide for implementing data-driven transformation.',
    type: 'document',
    url: '#',
    deadline: null,
    hasDeadline: false,
    tags: ['blueprint', 'implementation'],
  },
];

type ResourceCardProps = {
  resource: {
    id: number;
    title: string;
    description: string;
    type: string;
    url: string;
    deadline: Date | null;
    hasDeadline: boolean;
    tags: string[];
  };
};

const ResourceCard = ({ resource }: ResourceCardProps) => {
  const getIcon = () => {
    switch (resource.type) {
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'link':
        return <ExternalLink className="h-4 w-4" />;
      default:
        return <Link className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-bold">{resource.title}</CardTitle>
          <Badge variant="outline" className="ml-2">
            <div className="flex items-center gap-1">
              {getIcon()}
              <span className="capitalize">{resource.type}</span>
            </div>
          </Badge>
        </div>
        <CardDescription className="text-sm line-clamp-2 mt-1">
          {resource.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex flex-wrap gap-1 mt-2">
          {resource.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-0">
        {resource.hasDeadline && resource.deadline && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 mr-1" />
            <span>
              Due: {resource.deadline.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <a href={resource.url} target="_blank" rel="noopener noreferrer">
            View Resource
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
};

type ResourceFilterProps = {
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  showDeadlineOnly: boolean;
  setShowDeadlineOnly: React.Dispatch<React.SetStateAction<boolean>>;
};

const ResourceFilter = ({ searchTerm, setSearchTerm, showDeadlineOnly, setShowDeadlineOnly }: ResourceFilterProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <Input
        placeholder="Search resources..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="sm:max-w-xs"
      />
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="with-deadline" 
          checked={showDeadlineOnly} 
          onCheckedChange={setShowDeadlineOnly}
        />
        <label
          htmlFor="with-deadline"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Show resources with deadline only
        </label>
      </div>
    </div>
  );
};

const Resources = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeadlineOnly, setShowDeadlineOnly] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const handleAddResource = (resourceData: any) => {
    // In a real application, this would make an API call to add the resource
    console.log('Adding resource:', resourceData);
    // Would then update the resources state with the new resource
  };

  const filteredResources = resources.filter((resource) => {
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         resource.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (showDeadlineOnly) {
      return matchesSearch && resource.hasDeadline;
    }
    
    return matchesSearch;
  });

  const filteredBlueprintResources = blueprintResources.filter((resource) => {
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         resource.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (showDeadlineOnly) {
      return matchesSearch && resource.hasDeadline;
    }
    
    return matchesSearch;
  });

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Resources</h1>
          <p className="text-muted-foreground">
            Explore our curated collection of data science resources
          </p>
        </div>
        {isAdmin && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>Add Resource</Button>
            </DialogTrigger>
            <DialogContent>
              <AddResourceModal onAddResource={handleAddResource} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Resources</TabsTrigger>
          <TabsTrigger value="blueprint">Data Blueprint Series</TabsTrigger>
        </TabsList>

        <div className="mb-6">
          <ResourceFilter
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            showDeadlineOnly={showDeadlineOnly}
            setShowDeadlineOnly={setShowDeadlineOnly}
          />
        </div>

        <TabsContent value="all" className="space-y-4">
          {filteredResources.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredResources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-lg text-muted-foreground">No resources found matching your criteria.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="blueprint" className="space-y-4">
          <div className="bg-muted/50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-2">About the Data Blueprint Series</h2>
            <p>
              The Data Blueprint Series provides a comprehensive framework for organizations to assess, 
              plan, and implement data-driven transformation. These resources offer practical tools 
              and guidance for establishing robust data practices.
            </p>
          </div>

          {filteredBlueprintResources.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredBlueprintResources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-lg text-muted-foreground">No blueprint resources found matching your criteria.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Resources;
