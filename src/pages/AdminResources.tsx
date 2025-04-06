import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import AddResourceModal from '@/components/resources/AddResourceModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Trash2, ExternalLink, Calendar, FilterX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

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

export default function AdminResources() {
  const [resources, setResources] = useState(mockResources);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [deadlineFilter, setDeadlineFilter] = useState<boolean | null>(null);

  const handleAddResource = (newResource: any) => {
    setResources([...resources, newResource]);
    toast("Resource Added", {
      description: 'The resource has been successfully added to the directory.',
    });
  };

  const handleEditResource = (resource: any) => {
    toast("Edit Resource", {
      description: `Editing ${resource.name}`,
    });
  };

  const handleDeleteResource = (id: string) => {
    setResources(resources.filter(resource => resource.id !== id));
    toast("Resource Deleted", {
      description: 'The resource has been successfully removed from the directory.',
    });
  };

  const filteredResources = resources.filter((resource) => {
    const matchesSearch = 
      resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || resource.category === categoryFilter;
    
    const matchesDeadline = 
      deadlineFilter === null ? true : 
      deadlineFilter === true ? resource.deadline !== null : 
      resource.deadline === null;
    
    return matchesSearch && matchesCategory && matchesDeadline;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setDeadlineFilter(null);
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Resources</h1>
            <p className="text-muted-foreground mt-2">
              Add, edit, and remove resources from the resource directory.
            </p>
          </div>
          <AddResourceModal onAddResource={handleAddResource} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resources Directory</CardTitle>
            <CardDescription>
              Manage the resources that are available to users on the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="withDeadline" 
                      checked={deadlineFilter === true}
                      onCheckedChange={(checked) => {
                        setDeadlineFilter(checked ? true : (deadlineFilter === false ? null : false));
                      }}
                    />
                    <label
                      htmlFor="withDeadline"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      With deadline
                    </label>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Checkbox 
                      id="withoutDeadline" 
                      checked={deadlineFilter === false}
                      onCheckedChange={(checked) => {
                        setDeadlineFilter(checked ? false : (deadlineFilter === true ? null : true));
                      }}
                    />
                    <label
                      htmlFor="withoutDeadline"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Without deadline
                    </label>
                  </div>
                </div>
                
                {(searchQuery || categoryFilter !== 'all' || deadlineFilter !== null) && (
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

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResources.length > 0 ? (
                      filteredResources.map((resource) => (
                        <TableRow key={resource.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              {resource.name}
                              <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                                {resource.description}
                              </span>
                              <a 
                                href={resource.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline flex items-center mt-1"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" /> {resource.link}
                              </a>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {resource.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {resource.deadline ? (
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                                {formatDate(resource.deadline)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="24" 
                                    height="24" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    className="h-4 w-4"
                                  >
                                    <circle cx="12" cy="12" r="1" />
                                    <circle cx="12" cy="5" r="1" />
                                    <circle cx="12" cy="19" r="1" />
                                  </svg>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEditResource(resource)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the resource "{resource.name}". This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteResource(resource.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No resources found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
