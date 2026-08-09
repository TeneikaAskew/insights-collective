import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, User, Search, Filter, Star } from 'lucide-react';
import { getAllBlogPosts, getBlogCategories } from '@/services/blogService';
import { BlogPost, BlogCategory } from '@/types/blog';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('Blog');

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('');

  const isAdmin = user?.roles?.includes('admin');

  useEffect(() => {
    loadBlogData();
  }, []);

  useEffect(() => {
    // Handle URL parameters for category filtering
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    if (category) setSelectedCategory(category);
    if (tag) setSelectedTag(tag);
  }, [searchParams]);

  const loadBlogData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [postsData, categoriesData] = await Promise.all([
        // Public listing: ask the server for published posts only.
        getAllBlogPosts({ publishedOnly: true }),
        getBlogCategories()
      ]);
      setPosts(postsData);
      setCategories(categoriesData);
    } catch (error: any) {
      // A failed fetch must be visibly distinct from "no articles yet".
      logger.error('Error loading blog data:', error);
      setLoadError(error?.message || 'Failed to load blog articles.');
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = !searchTerm || 
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;
    
    const matchesTag = !selectedTag || 
      (post.tags && post.tags.some(tag => tag.toLowerCase().includes(selectedTag.toLowerCase())));
    
    const isPublished = post.status === 'published';
    
    return matchesSearch && matchesCategory && matchesTag && isPublished;
  });

  // Separate featured posts from regular posts
  const featuredPosts = filteredPosts.filter(post => post.featured);
  const regularPosts = filteredPosts.filter(post => !post.featured);

  // Get all unique tags from posts
  const allTags = Array.from(new Set(posts.flatMap(post => post.tags || [])));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedTag('');
    setSearchParams({});
  };

  if (loadError) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8 px-4">
          <Card>
            <CardContent className="py-12 text-center" role="alert">
              <p className="text-destructive font-medium mb-2">Failed to load blog articles</p>
              <p className="text-muted-foreground mb-4">{loadError}</p>
              <Button variant="outline" onClick={loadBlogData}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8 px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg"></div>
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageSeo
        title="Blog — Data Career Insights | Insights Collective"
        description="Articles on data, analytics and AI careers: skills to learn, hiring trends, portfolio advice and interview preparation."
        path="/blog"
      />
      <div className="container mx-auto py-8 px-4">

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Data Blueprint Series</h1>
              <p className="text-muted-foreground max-w-2xl">
                Comprehensive guides, insights, and practical knowledge for data science professionals. 
                From fundamentals to advanced techniques, explore the complete data science journey.
              </p>
            </div>
            {isAdmin && (
              <Link to="/admin/blog">
                <Button>
                  Manage Blog
                </Button>
              </Link>
            )}
          </div>

          {/* Search and Filter Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.name} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              {/* Radix Select throws on an empty-string item value; use a
                  sentinel and map it back to "no tag filter". */}
              <Select
                value={selectedTag || '__all__'}
                onValueChange={(value) => setSelectedTag(value === '__all__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Tags</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(searchTerm || selectedCategory !== 'all' || selectedTag) && (
                <Button variant="outline" onClick={clearFilters} size="sm">
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Featured Posts Section */}
        {featuredPosts.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Star className="h-5 w-5 text-ss-warn" />
              <h2 className="text-2xl font-bold">Featured Articles</h2>
            </div>
            <div data-testid="featured-posts-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {featuredPosts.slice(0, 2).map(post => (
                <Card key={post.id} className="overflow-hidden border-border ss-card-warm">
                  {post.imageUrl && (
                    <div className="h-48 overflow-hidden">
                      <img 
                        src={post.imageUrl} 
                        alt={post.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-ss-warn" />
                      <Badge variant="secondary" className="bg-ss-warn-chip text-ss-warn">
                        Featured
                      </Badge>
                      <Badge variant="outline">{post.category}</Badge>
                    </div>
                    <CardTitle className="text-xl mb-2">
                      <Link 
                        to={`/blog/${post.slug}`}
                        className="hover:text-primary transition-colors"
                      >
                        {post.title}
                      </Link>
                    </CardTitle>
                    <CardDescription className="text-base line-clamp-3">
                      {post.excerpt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{post.authorName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(post.publishedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{post.readTime} min read</span>
                        </div>
                      </div>
                    </div>
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {post.tags.slice(0, 3).map(tag => (
                          <Badge 
                            key={tag} 
                            variant="secondary" 
                            className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => {
                              setSelectedTag(tag);
                              setSearchParams({ tag });
                            }}
                          >
                            {tag}
                          </Badge>
                        ))}
                        {post.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{post.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Regular Posts Section */}
        <div>
          <h2 className="text-2xl font-bold mb-6">All Articles</h2>
          {regularPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No articles found matching your criteria.</p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div data-testid="all-posts-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularPosts.map(post => (
                <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {post.imageUrl && (
                    <div className="h-48 overflow-hidden">
                      <img 
                        src={post.imageUrl} 
                        alt={post.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{post.category}</Badge>
                      {post.views && post.views > 100 && (
                        <Badge variant="secondary">Popular</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg mb-2">
                      <Link 
                        to={`/blog/${post.slug}`}
                        className="hover:text-primary transition-colors"
                      >
                        {post.title}
                      </Link>
                    </CardTitle>
                    <CardDescription className="line-clamp-3">
                      {post.excerpt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(post.publishedAt)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{post.readTime} min read</span>
                      </div>
                    </div>
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {post.tags.slice(0, 2).map(tag => (
                          <Badge 
                            key={tag} 
                            variant="secondary" 
                            className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => {
                              setSelectedTag(tag);
                              setSearchParams({ tag });
                            }}
                          >
                            {tag}
                          </Badge>
                        ))}
                        {post.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{post.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Categories Overview */}
        {categories.length > 0 && (
          <div className="mt-12 pt-8 border-t">
            <h3 className="text-xl font-semibold mb-4">Explore by Category</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {categories.map(category => (
                <Button
                  key={category.name}
                  variant={selectedCategory === category.name ? "default" : "outline"}
                  className="justify-start h-auto p-3"
                  onClick={() => {
                    setSelectedCategory(category.name);
                    setSearchParams({ category: category.name });
                  }}
                >
                  <div className="text-left">
                    <div className="font-medium text-sm">{category.name}</div>
                    <div className="text-xs opacity-70">{category.count} articles</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
