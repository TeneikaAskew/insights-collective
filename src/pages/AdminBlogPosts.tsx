
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Plus, Search, Edit, Trash2, Eye, ArrowUpDown, Calendar 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/components/layout/AppLayout';
import { BlogPost } from '@/types/blog';
import { getAllBlogPosts } from '@/services/blogService';
import { format } from 'date-fns';

const AdminBlogPosts = () => {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'title' | 'publishedAt'>('publishedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBlogPosts = async () => {
      setIsLoading(true);
      try {
        const posts = await getAllBlogPosts();
        setBlogPosts(posts);
      } catch (error) {
        console.error('Error fetching blog posts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlogPosts();
  }, []);

  const handleSort = (field: 'title' | 'publishedAt') => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredPosts = blogPosts.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortField === 'title') {
      return sortDirection === 'asc' 
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
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

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Blog Posts</h1>
            <p className="text-muted-foreground mt-1">
              Manage your blog content
            </p>
          </div>
          
          <Link to="/admin/blog/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Post
            </Button>
          </Link>
        </div>

        <div className="bg-card rounded-lg border shadow-sm">
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search blog posts..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Separator className="my-4" />
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">
                      <Button 
                        variant="ghost" 
                        className="p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('title')}
                      >
                        Title
                        <ArrowUpDown className={`ml-2 h-4 w-4 ${sortField === 'title' ? 'opacity-100' : 'opacity-30'}`} />
                      </Button>
                    </TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        className="p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('publishedAt')}
                      >
                        Published
                        <ArrowUpDown className={`ml-2 h-4 w-4 ${sortField === 'publishedAt' ? 'opacity-100' : 'opacity-30'}`} />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : sortedPosts.length > 0 ? (
                    sortedPosts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="font-medium">
                          {post.title}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
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
                        <TableCell className="flex items-center text-muted-foreground">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(post.publishedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/blog/${post.slug}`}>
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View</span>
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/admin/blog/edit/${post.slug}`}>
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <p className="text-muted-foreground">No blog posts found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminBlogPosts;
