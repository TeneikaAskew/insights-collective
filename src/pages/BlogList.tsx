
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Search, Calendar, ArrowRight, Plus, Tag, Clock, Eye, Filter, 
  BookOpen, BarChart2, FileText, ChevronRight
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import AppLayout from '@/components/layout/AppLayout';
import { BlogPost, BlogCategory } from '@/types/blog';
import { getAllBlogPosts, getBlogCategories } from '@/services/blogService';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

const BlogList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(
    searchParams.get('tag') || null
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get('category') || null
  );
  const [sortBy, setSortBy] = useState<string>(
    searchParams.get('sort') || 'recent'
  );
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, isAdminAuthenticated } = useAuth();

  useEffect(() => {
    fetchBlogPosts();
    fetchCategories();
  }, []);

  useEffect(() => {
    // Update URL search params when filters change
    const params = new URLSearchParams();
    if (selectedTag) params.set('tag', selectedTag);
    if (selectedCategory) params.set('category', selectedCategory);
    if (sortBy !== 'recent') params.set('sort', sortBy);
    setSearchParams(params);
  }, [selectedTag, selectedCategory, sortBy, setSearchParams]);

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
  
  const fetchCategories = async () => {
    try {
      const fetchedCategories = await getBlogCategories();
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Extract all unique tags from blog posts
  const allTags = Array.from(
    new Set(blogPosts.flatMap(post => post.tags || []))
  ).sort();

  // Filter and sort blog posts
  const filteredPosts = blogPosts
    .filter(post => post.status === 'published') // Only show published posts
    .filter(post => {
      const matchesSearch = searchQuery 
        ? post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      
      const matchesTag = selectedTag 
        ? post.tags.includes(selectedTag)
        : true;
      
      const matchesCategory = selectedCategory
        ? (post.category || 'Uncategorized') === selectedCategory
        : true;
      
      return matchesSearch && matchesTag && matchesCategory;
    });

  // Sort posts based on selected sort option
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    switch (sortBy) {
      case 'popular':
        return (b.views || 0) - (a.views || 0);
      case 'title':
        return a.title.localeCompare(b.title);
      case 'oldest':
        return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      case 'recent':
      default:
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    }
  });

  const handleTagClick = (tag: string) => {
    setSelectedTag(selectedTag === tag ? null : tag);
  };
  
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category === 'all' ? null : category);
  };
  
  const handleSortChange = (sort: string) => {
    setSortBy(sort);
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
      <div className="container mx-auto max-w-7xl py-8 px-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
          <div className="lg:col-span-3">
            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search articles..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Sort
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleSortChange('recent')} className={sortBy === 'recent' ? 'bg-muted' : ''}>
                    Most Recent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('popular')} className={sortBy === 'popular' ? 'bg-muted' : ''}>
                    Most Popular
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('title')} className={sortBy === 'title' ? 'bg-muted' : ''}>
                    Alphabetical
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('oldest')} className={sortBy === 'oldest' ? 'bg-muted' : ''}>
                    Oldest First
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Featured Post - Show first post in a larger format if available */}
            {sortedPosts.length > 0 && !searchQuery && !selectedTag && !selectedCategory && (
              <div className="mb-8">
                <Card className="overflow-hidden">
                  {sortedPosts[0].imageUrl && (
                    <div className="h-64 overflow-hidden">
                      <img 
                        src={sortedPosts[0].imageUrl} 
                        alt={sortedPosts[0].title} 
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex gap-2">
                        <Badge variant="outline">{sortedPosts[0].category || 'Uncategorized'}</Badge>
                        {sortedPosts[0].featured && <Badge className="bg-amber-500">Featured</Badge>}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(sortedPosts[0].publishedAt)}
                      </div>
                    </div>
                    
                    <h2 className="text-3xl font-bold mb-2 hover:text-primary transition-colors">
                      <Link to={`/blog/${sortedPosts[0].slug}`}>{sortedPosts[0].title}</Link>
                    </h2>
                    
                    <p className="text-muted-foreground mb-4">{sortedPosts[0].excerpt}</p>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {sortedPosts[0].readTime} min read
                        </div>
                        <div className="flex items-center">
                          <Eye className="h-4 w-4 mr-1" />
                          {sortedPosts[0].views?.toLocaleString() || '0'} views
                        </div>
                      </div>
                      <Button variant="default" asChild>
                        <Link to={`/blog/${sortedPosts[0].slug}`}>Read Article</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Blog Post Listing */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-pulse space-y-4 w-full">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-muted h-48 rounded-lg"></div>
                  ))}
                </div>
              </div>
            ) : sortedPosts.length > (searchQuery || selectedTag || selectedCategory ? 0 : 1) ? (
              <div className="space-y-6">
                {sortedPosts.slice(searchQuery || selectedTag || selectedCategory ? 0 : 1).map((post) => (
                  <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row">
                      {post.imageUrl && (
                        <div className="md:w-1/3">
                          <Link to={`/blog/${post.slug}`}>
                            <img 
                              src={post.imageUrl} 
                              alt={post.title} 
                              className="h-full w-full object-cover"
                            />
                          </Link>
                        </div>
                      )}
                      <div className={`${post.imageUrl ? 'md:w-2/3' : 'w-full'}`}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex gap-2">
                              <Badge variant="outline">{post.category || 'Uncategorized'}</Badge>
                              {post.featured && <Badge className="bg-amber-500">Featured</Badge>}
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4 mr-1" />
                              {formatDate(post.publishedAt)}
                            </div>
                          </div>
                          
                          <h2 className="text-2xl font-bold mb-2 hover:text-primary transition-colors">
                            <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                          </h2>
                          
                          <p className="text-muted-foreground mb-4 line-clamp-2">{post.excerpt}</p>
                        </CardContent>
                        <CardFooter className="px-6 pb-6 pt-0 flex justify-between items-center">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {post.readTime} min read
                            </div>
                            <div className="flex items-center">
                              <Eye className="h-4 w-4 mr-1" />
                              {post.views?.toLocaleString() || '0'} views
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/blog/${post.slug}`} className="flex items-center">
                              Read more <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </CardFooter>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/30 rounded-lg">
                <h3 className="text-xl font-medium mb-2">No posts found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || selectedTag || selectedCategory
                    ? "Try adjusting your search or filter criteria."
                    : "Check back soon for new content!"}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    variant={selectedCategory === null ? "default" : "outline"} 
                    className="w-full justify-start"
                    onClick={() => handleCategoryChange('all')}
                  >
                    All Categories
                  </Button>
                  {categories.map((category) => (
                    <Button 
                      key={category.slug}
                      variant={selectedCategory === category.name ? "default" : "outline"}
                      className="w-full justify-between"
                      onClick={() => handleCategoryChange(category.name)}
                    >
                      {category.name}
                      <Badge variant="secondary" className="ml-2">{category.count}</Badge>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Tag className="mr-2 h-4 w-4" />
                  Popular Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Series
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li>
                    <Link to="/data-blueprint" className="text-primary hover:underline flex items-center">
                      <ArrowRight className="h-3 w-3 mr-2" />
                      Data Blueprint Series
                    </Link>
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart2 className="mr-2 h-4 w-4" />
                  Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Posts:</span>
                    <span className="font-medium">{blogPosts.filter(p => p.status === 'published').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Categories:</span>
                    <span className="font-medium">{categories.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tags:</span>
                    <span className="font-medium">{allTags.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default BlogList;
