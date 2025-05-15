import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Eye, Pencil, Trash, Search, Plus, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { BlogPost } from '@/types/blog';
import { getAllBlogPosts, deleteBlogPost } from '@/services/blogService';
import { toast } from '@/hooks/use-toast'; // Fixed import
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const AdminBlogPosts = () => {
  const navigate = useNavigate();
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Default to descending
  const [sortBy, setSortBy] = useState<'publishedAt'>('publishedAt'); // Default sort by publishedAt

  useEffect(() => {
    const fetchBlogPosts = async () => {
      setLoading(true);
      try {
        const posts = await getAllBlogPosts();
        setBlogPosts(posts);
      } catch (error) {
        console.error('Error fetching blog posts:', error);
        toast({
          title: "Error",
          description: "Failed to load blog posts",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBlogPosts();
  }, []);

  useEffect(() => {
    // Apply search filter
    const searchedPosts = blogPosts.filter(post =>
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Apply sorting
    const sortedPosts = [...searchedPosts].sort((a, b) => {
      const dateA = new Date(a.publishedAt).getTime();
      const dateB = new Date(b.publishedAt).getTime();

      if (sortBy === 'publishedAt') {
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return 0;
    });

    setFilteredPosts(sortedPosts);
  }, [blogPosts, searchQuery, sortOrder, sortBy]);

  const handleDelete = async (slug: string) => {
    if (window.confirm('Are you sure you want to delete this blog post?')) {
      try {
        await deleteBlogPost(slug);
        setBlogPosts(blogPosts.filter(post => post.slug !== slug));
        toast({
          title: "Success",
          description: "Blog post deleted successfully!"
        });
      } catch (error) {
        console.error('Error deleting blog post:', error);
        toast({
          title: "Error",
          description: "Failed to delete blog post",
          variant: "destructive"
        });
      }
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  const handleSortOrderChange = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <AdminGuard>
      <AppLayout>
        <div className="container mx-auto py-8 px-4">
          <div className="flex items-center justify-between mb-6">
            <PageTitle title="Blog Post Management" />
            <Button asChild>
              <Link to="/admin/blog/create">
                <Plus className="mr-2 h-4 w-4" />
                Create New
              </Link>
            </Button>
          </div>

          <div className="flex items-center justify-between mb-4">
            <Input
              type="text"
              placeholder="Search by title or excerpt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Sort By
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSortOrderChange}>
                  Date {sortOrder === 'asc' ? ' (Oldest First)' : ' (Newest First)'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Published Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPosts.map((post) => (
                    <TableRow key={post.slug}>
                      <TableCell className="font-medium">{post.title}</TableCell>
                      <TableCell>
                        <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                          {post.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{post.category}</TableCell>
                      <TableCell>{formatDate(post.publishedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            asChild
                          >
                            <Link to={`/blog/${post.slug}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            asChild
                          >
                            <Link to={`/admin/blog/edit/${post.slug}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDelete(post.slug)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </AppLayout>
    </AdminGuard>
  );
};

export default AdminBlogPosts;
