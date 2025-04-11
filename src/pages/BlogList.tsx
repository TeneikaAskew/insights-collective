
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Calendar, ArrowRight, Plus } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { BlogPost } from '@/types/blog';
import { getAllBlogPosts } from '@/services/blogService';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

const BlogList = () => {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, isAdminAuthenticated } = useAuth();

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

  // Extract all unique tags from blog posts
  const allTags = Array.from(
    new Set(blogPosts.flatMap(post => post.tags || []))
  ).sort();

  // Filter blog posts based on search query and selected tag
  const filteredPosts = blogPosts.filter(post => {
    const matchesSearch = searchQuery 
      ? post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    
    const matchesTag = selectedTag 
      ? post.tags.includes(selectedTag)
      : true;
    
    return matchesSearch && matchesTag;
  });

  const handleTagClick = (tag: string) => {
    setSelectedTag(selectedTag === tag ? null : tag);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-5xl py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold">Blog</h1>
            <p className="text-muted-foreground mt-2">
              Insights, tutorials, and resources for data professionals
            </p>
          </div>
          
          {(isAuthenticated && isAdminAuthenticated) && (
            <Link to="/admin/blog/create">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Post
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-3">
            {/* Search Input */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search articles..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Blog Post Listing */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-pulse space-y-4 w-full">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-muted h-48 rounded-lg"></div>
                  ))}
                </div>
              </div>
            ) : filteredPosts.length > 0 ? (
              <div className="space-y-6">
                {filteredPosts.map((post) => (
                  <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex gap-2">
                          {post.tags && post.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="cursor-pointer" onClick={() => handleTagClick(tag)}>
                              {tag}
                            </Badge>
                          ))}
                          {post.tags && post.tags.length > 2 && (
                            <Badge variant="outline">+{post.tags.length - 2} more</Badge>
                          )}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(post.publishedAt)}
                        </div>
                      </div>
                      
                      <h2 className="text-2xl font-bold mb-2 hover:text-primary transition-colors">
                        <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                      </h2>
                      
                      <p className="text-muted-foreground mb-4">{post.excerpt}</p>
                    </CardContent>
                    <CardFooter className="px-6 pb-6 pt-0 flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        {post.authorName && `By ${post.authorName}`}
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/blog/${post.slug}`} className="flex items-center">
                          Read more <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/30 rounded-lg">
                <h3 className="text-xl font-medium mb-2">No posts found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || selectedTag 
                    ? "Try adjusting your search or filter criteria."
                    : "Check back soon for new content!"}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <Badge 
                    key={tag}
                    variant={selectedTag === tag ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleTagClick(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-semibold mb-3">Popular Series</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/data-blueprint" className="text-primary hover:underline flex items-center">
                    <ArrowRight className="h-3 w-3 mr-2" />
                    Data Blueprint Series
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default BlogList;
