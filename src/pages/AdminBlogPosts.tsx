
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Plus, Search, Edit, Trash2, Eye, ArrowUpDown, Calendar, 
  Filter, BarChart2, ListFilter, Star, StarOff, FileCheck, FileX, Archive
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import AppLayout from '@/components/layout/AppLayout';
import { BlogPost } from '@/types/blog';
import { getAllBlogPosts, deleteBlogPost, getBlogCategories } from '@/services/blogService';
import { format } from 'date-fns';

import { createLogger } from '@/utils/logger';

const logger = createLogger('AdminBlogPosts');

const AdminBlogPosts = () => {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'title' | 'publishedAt' | 'views'>('publishedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Analytics overview data
  const [analyticsData, setAnalyticsData] = useState({
    totalPosts: 0,
    publishedPosts: 0,
    draftPosts: 0,
    archivedPosts: 0,
    totalViews: 0,
    categoriesCount: 0,
    tagsCount: 0
  });

  useEffect(() => {
    fetchBlogPosts();
    fetchCategories();
  }, []);

  const fetchBlogPosts = async () => {
    setIsLoading(true);
    try {
      const posts = await getAllBlogPosts();
      setBlogPosts(posts);
      
      // Calculate analytics
      const publishedPosts = posts.filter(post => post.status === 'published').length;
      const draftPosts = posts.filter(post => post.status === 'draft').length;
      const archivedPosts = posts.filter(post => post.status === 'archived').length;
      const totalViews = posts.reduce((sum, post) => sum + (post.views || 0), 0);
      
      // Get unique categories and tags
      const categories = new Set(posts.map(post => post.category || 'Uncategorized'));
      const tags = new Set(posts.flatMap(post => post.tags || []));
      
      setAnalyticsData({
        totalPosts: posts.length,
        publishedPosts,
        draftPosts,
        archivedPosts,
        totalViews,
        categoriesCount: categories.size,
        tagsCount: tags.size
      });
    } catch (error) {
      logger.error('Error fetching blog posts:', error);
      toast({
        title: "Error",
        description: "Failed to load blog posts. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const categoryData = await getBlogCategories();
      setCategories(['all', ...categoryData.map(cat => cat.name)]);
    } catch (error) {
      logger.error('Error fetching categories:', error);
    }
  };

  const handleSort = (field: 'title' | 'publishedAt' | 'views') => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!postToDelete) return;
    
    try {
      const success = await deleteBlogPost(postToDelete.slug);
      if (success) {
        setBlogPosts(blogPosts.filter(post => post.id !== postToDelete.id));
        toast({
          title: "Success",
          description: `"${postToDelete.title}" has been deleted.`,
        });
      } else {
        throw new Error("Failed to delete post");
      }
    } catch (error) {
      logger.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete the post. Please try again.",
        variant: "destructive"
      });
    } finally {
      setShowDeleteDialog(false);
      setPostToDelete(null);
    }
  };

  const handleDeleteClick = (post: BlogPost) => {
    setPostToDelete(post);
    setShowDeleteDialog(true);
  };

  // Apply all filters and sorting
  const filteredPosts = blogPosts.filter(post => {
    const matchesSearch = searchQuery
      ? post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    
    const matchesStatus = filterStatus === 'all' 
      ? true 
      : filterStatus === 'featured'
        ? !!post.featured
        : post.status === filterStatus;
    
    const matchesCategory = filterCategory === 'all'
      ? true
      : (post.category || 'Uncategorized') === filterCategory;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortField === 'title') {
      return sortDirection === 'asc' 
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    } else if (sortField === 'views') {
      const viewsA = a.views || 0;
      const viewsB = b.views || 0;
      return sortDirection === 'asc' ? viewsA - viewsB : viewsB - viewsA;
    } else {
      const dateA = new Date(a.publishedAt).getTime();
      const dateB = new Date(b.publishedAt).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }
  });

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-600">Published</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Blog Management</h1>
            <p className="text-muted-foreground mt-1">
              Create, edit, and manage your blog content
            </p>
          </div>
          
          <Link to="/admin/blog/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Post
            </Button>
          </Link>
        </div>

        {/* Analytics Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Posts</p>
                  <p className="text-3xl font-bold">{analyticsData.totalPosts}</p>
                </div>
                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <FileCheck className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Published</p>
                  <p className="text-3xl font-bold">{analyticsData.publishedPosts}</p>
                </div>
                <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <FileCheck className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Drafts</p>
                  <p className="text-3xl font-bold">{analyticsData.draftPosts}</p>
                </div>
                <div className="h-12 w-12 bg-orange-500/10 rounded-full flex items-center justify-center">
                  <FileX className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Views</p>
                  <p className="text-3xl font-bold">{analyticsData.totalViews.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <BarChart2 className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-card rounded-lg border shadow-sm">
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search blog posts..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Select 
                value={filterStatus} 
                onValueChange={setFilterStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Posts</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Drafts</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={filterCategory} 
                onValueChange={setFilterCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Separator className="my-4" />
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">
                      <Button 
                        variant="ghost" 
                        className="p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('title')}
                      >
                        Title
                        <ArrowUpDown className={`ml-2 h-4 w-4 ${sortField === 'title' ? 'opacity-100' : 'opacity-30'}`} />
                      </Button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        className="p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('views')}
                      >
                        Views
                        <ArrowUpDown className={`ml-2 h-4 w-4 ${sortField === 'views' ? 'opacity-100' : 'opacity-30'}`} />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        className="p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('publishedAt')}
                      >
                        Date
                        <ArrowUpDown className={`ml-2 h-4 w-4 ${sortField === 'publishedAt' ? 'opacity-100' : 'opacity-30'}`} />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : sortedPosts.length > 0 ? (
                    sortedPosts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {post.featured && <Star className="h-4 w-4 text-amber-500" />}
                            {post.title}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {post.tags && post.tags.slice(0, 2).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {post.tags && post.tags.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{post.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(post.status || 'draft')}</TableCell>
                        <TableCell>{post.category || 'Uncategorized'}</TableCell>
                        <TableCell>{post.views?.toLocaleString() || '0'}</TableCell>
                        <TableCell className="flex items-center text-muted-foreground">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(post.publishedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <ListFilter className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/blog/${post.slug}`} className="flex items-center">
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to={`/admin/blog/edit/${post.id}`} className="flex items-center">
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteClick(post)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <p className="text-muted-foreground">No blog posts found</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          <Link to="/admin/blog/new" className="text-primary hover:underline">
                            Create your first blog post
                          </Link>
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Blog Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{postToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminBlogPosts;
