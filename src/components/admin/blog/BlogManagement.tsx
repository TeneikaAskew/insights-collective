import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Filter,
  FileText,
  FolderTree,
  BarChart3,
  Settings,
  Calendar,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  TrendingUp,
  Users,
  Clock,
  Star,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { BlogCategoriesManager } from '@/components/blog/categories/BlogCategoriesManager';
import { BlogAnalyticsDashboard } from '@/components/blog/analytics/BlogAnalyticsDashboard';
import { BlogSettings } from './BlogSettings';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

import { createLogger } from '@/utils/logger';

const logger = createLogger('BlogManagement');

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content?: string;
  excerpt?: string;
  status: 'draft' | 'published' | 'scheduled';
  author_id: string;
  category_id?: string;
  views_count: number;
  likes_count: number;
  reading_time?: number;
  is_featured: boolean;
  published_at?: string;
  scheduled_at?: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  author: {
    full_name?: string;
  };
  category?: {
    name: string;
  };
}

type SortField = 'title' | 'views' | 'date';
type SortDirection = 'asc' | 'desc';

export function BlogManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  // Admins manage the whole blog; instructors manage only what they authored.
  // This mirrors the RLS policies rather than adding a second access model.
  const isAdmin = !!user?.roles?.includes('admin');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<BlogPost | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [stats, setStats] = useState({
    totalPosts: 0,
    publishedPosts: 0,
    draftPosts: 0,
    scheduledPosts: 0,
    totalViews: 0,
    totalLikes: 0,
  });

  useEffect(() => {
    loadPosts();
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, isAdmin, user?.id]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('blog_categories')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      logger.error('Error loading categories:', error);
    }
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      // Get blog posts with separate queries to avoid relationship issues.
      // Instructors see only their own posts: RLS lets them READ every post
      // (so they can review), but they can only edit what they authored —
      // listing other people's posts would offer actions that always fail.
      let postsQuery = supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin && user?.id) {
        postsQuery = postsQuery.eq('author_id', user.id);
      }

      const { data: postsData, error: postsError } = await postsQuery;

      if (postsError) throw postsError;

      // The three enrichment reads below were unchecked while the posts query
      // above throws on error. That asymmetry is the bug: a failed enrichment
      // still rendered the post list, but with every author as "Unknown", every
      // category blank and every tag missing — which reads as a data-entry
      // problem in the posts themselves rather than a failed query. They are
      // genuinely non-fatal (the list is still usable), so they warn instead of
      // throwing, but they no longer pass silently.
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('blog_categories')
        .select('id, name');

      const { data: authorsData, error: authorsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name');

      // Tags for every post in one query, grouped client-side — never per-post
      // (an N+1 here would fire one request per row in the list).
      const { data: tagsData, error: tagsError } = await supabase
        .from('blog_post_tags')
        .select('blog_post_id, tag_name');

      const degraded = [
        categoriesError && 'categories',
        authorsError && 'authors',
        tagsError && 'tags',
      ].filter(Boolean) as string[];

      if (degraded.length) {
        logger.error('Blog list enrichment failed; rows will show gaps', {
          missing: degraded,
          categoriesError,
          authorsError,
          tagsError,
        });
        toast({
          title: `Could not load ${degraded.join(', ')}`,
          description:
            'Posts are listed, but those columns are blank because the lookup failed — not because the posts are missing that data.',
          variant: 'destructive',
        });
      }

      // Index authors and categories once instead of scanning per post.
      const authorsById = new Map((authorsData || []).map((a) => [a.id, a]));
      const categoriesById = new Map((categoriesData || []).map((c) => [c.id, c]));
      const tagsByPost = new Map<string, string[]>();
      for (const row of (tagsData || []) as Array<{ blog_post_id: string; tag_name: string }>) {
        if (!row.blog_post_id || !row.tag_name) continue;
        const existing = tagsByPost.get(row.blog_post_id);
        if (existing) existing.push(row.tag_name);
        else tagsByPost.set(row.blog_post_id, [row.tag_name]);
      }

      // Combine the data
      const enrichedPosts = (postsData || []).map(post => {
        const author = authorsById.get(post.author_id);
        const category = categoriesById.get(post.category_id);
        return {
          id: post.id,
          title: post.title,
          slug: post.slug,
          content: post.content,
          excerpt: post.excerpt,
          status: post.status,
          author_id: post.author_id,
          category_id: post.category_id,
          views_count: post.view_count || 0,
          likes_count: post.likes_count || 0,
          reading_time: post.read_time,
          is_featured: post.featured,
          published_at: post.published_at,
          scheduled_at: post.scheduled_at ?? null,
          created_at: post.created_at,
          updated_at: post.updated_at,
          tags: tagsByPost.get(post.id) || [],
          author: {
            full_name: author
              ? `${author.first_name || ''} ${author.last_name || ''}`.trim()
              : '',
          },
          category: category ? { name: category.name || '' } : undefined,
        };
      });

      // Apply filters
      // A post is "scheduled" when it has a future scheduled_at (there is no
      // 'scheduled' value in the status CHECK constraint).
      const nowIso = new Date().toISOString();
      const isScheduled = (p: { scheduled_at?: string | null }) =>
        !!p.scheduled_at && p.scheduled_at > nowIso;

      let filteredPosts = enrichedPosts;
      if (statusFilter === 'scheduled') {
        filteredPosts = filteredPosts.filter(isScheduled);
      } else if (statusFilter === 'featured') {
        // "Featured" is a flag, not a status value — filter on the flag.
        filteredPosts = filteredPosts.filter(p => p.is_featured);
      } else if (statusFilter !== 'all') {
        filteredPosts = filteredPosts.filter(p => p.status === statusFilter);
      }
      if (categoryFilter !== 'all') {
        filteredPosts = filteredPosts.filter(p => p.category_id === categoryFilter);
      }

      setPosts(filteredPosts as unknown as BlogPost[]);

      // Calculate stats from all posts (not just filtered)
      const totalPosts = enrichedPosts.length;
      const publishedPosts = enrichedPosts.filter(p => p.status === 'published').length;
      const draftPosts = enrichedPosts.filter(p => p.status === 'draft').length;
      const scheduledPosts = enrichedPosts.filter(isScheduled).length;
      const totalViews = enrichedPosts.reduce((sum, p) => sum + (p.views_count || 0), 0);
      const totalLikes = enrichedPosts.reduce((sum, p) => sum + (p.likes_count || 0), 0);

      setStats({
        totalPosts,
        publishedPosts,
        draftPosts,
        scheduledPosts,
        totalViews,
        totalLikes,
      });
    } catch (error) {
      logger.error('Error loading posts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load blog posts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Blog post deleted successfully',
      });

      setDeleteConfirm(null);
      loadPosts();
    } catch (error) {
      logger.error('Error deleting post:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete blog post',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (post: BlogPost) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      // A duplicate needs its own slug — slug is UNIQUE, and the original's
      // would collide. Suffix with a short timestamp for a stable unique value.
      const copySlug = `${post.slug}-copy-${Date.now().toString(36)}`;

      const { data: newPost, error } = await supabase
        .from('blog_posts')
        .insert({
          title: `${post.title} (Copy)`,
          slug: copySlug,
          content: post.content || '',
          excerpt: post.excerpt,
          status: 'draft',
          // Authorship follows the original author, not whoever clicked
          // Duplicate. RLS still permits the insert: admins may write any
          // author_id, and an instructor duplicating their own post is
          // unaffected.
          author_id: post.author_id || userData.user.id,
          category_id: post.category_id,
          read_time: post.reading_time,
          featured: false,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Carry the tags over — a copy without them silently loses metadata.
      if (newPost && post.tags.length > 0) {
        const { error: tagError } = await supabase
          .from('blog_post_tags')
          .insert(post.tags.map(tag_name => ({ blog_post_id: newPost.id, tag_name })));
        if (tagError) throw tagError;
      }

      toast({
        title: 'Success',
        description: 'Blog post duplicated successfully',
      });

      loadPosts();
    } catch (error) {
      logger.error('Error duplicating post:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate blog post',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'scheduled':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Titles read best A→Z; numbers and dates read best largest/newest first.
      setSortDirection(field === 'title' ? 'asc' : 'desc');
    }
  };

  const postDate = (post: BlogPost) =>
    new Date(post.published_at || post.created_at).getTime();

  const filteredPosts = posts
    .filter(post => {
      const searchLower = searchQuery.toLowerCase();
      return (
        post.title.toLowerCase().includes(searchLower) ||
        post.excerpt?.toLowerCase().includes(searchLower) ||
        post.author.full_name?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'title') return a.title.localeCompare(b.title) * dir;
      if (sortField === 'views') return ((a.views_count || 0) - (b.views_count || 0)) * dir;
      return (postDate(a) - postDate(b)) * dir;
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blog Management</h1>
          <p className="text-muted-foreground">
            Create, manage, and analyze your blog content
          </p>
        </div>
        <Button onClick={() => navigate('/admin/blog/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPosts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.publishedPosts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <Edit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draftPosts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduledPosts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Likes</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLikes.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="posts">
            <FileText className="h-4 w-4 mr-2" />
            Posts
          </TabsTrigger>
          {/* Categories and Settings write to blog_categories / blog_settings,
              which RLS restricts to admins. Rendering them for an instructor
              would show controls whose every save fails, so hide them. */}
          {isAdmin && (
            <TabsTrigger value="categories">
              <FolderTree className="h-4 w-4 mr-2" />
              Categories
            </TabsTrigger>
          )}
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="posts" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search posts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="featured">Featured</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <span className="text-sm text-muted-foreground">Sort by</span>
                {([
                  { field: 'title' as SortField, label: 'Title' },
                  { field: 'views' as SortField, label: 'Views' },
                  { field: 'date' as SortField, label: 'Date' },
                ]).map(({ field, label }) => (
                  <Button
                    key={field}
                    variant={sortField === field ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => toggleSort(field)}
                    aria-pressed={sortField === field}
                  >
                    {label}
                    {sortField === field ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 ml-1.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 ml-1.5" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 ml-1.5 opacity-40" />
                    )}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Posts List */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-64" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="p-6 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No posts found</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="divide-y">
                    {filteredPosts.map((post) => (
                      <div key={post.id} className="p-6 hover:bg-accent/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">
                                {post.title}
                              </h3>
                              {post.is_featured && (
                                <Badge variant="secondary">
                                  <Star className="h-3 w-3 mr-1" />
                                  Featured
                                </Badge>
                              )}
                              <Badge variant={getStatusColor(post.status)}>
                                {post.status}
                              </Badge>
                            </div>
                            {post.excerpt && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {post.excerpt}
                              </p>
                            )}
                            {post.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1">
                                {post.tags.slice(0, 2).map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {post.tags.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{post.tags.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{post.author.full_name}</span>
                              {post.category && (
                                <>
                                  <span>•</span>
                                  <span>{post.category.name}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {post.views_count}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {post.likes_count}
                              </span>
                              {post.reading_time && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {post.reading_time} min
                                  </span>
                                </>
                              )}
                              <span>•</span>
                              <span>
                                {post.published_at 
                                  ? format(new Date(post.published_at), 'MMM dd, yyyy')
                                  : format(new Date(post.created_at), 'MMM dd, yyyy')}
                              </span>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/admin/blog/edit/${post.id}`)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(`/blog/${post.slug}`, '_blank')}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(post)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setDeleteConfirm(post)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="categories">
            <BlogCategoriesManager />
          </TabsContent>
        )}

        <TabsContent value="analytics">
          <BlogAnalyticsDashboard />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="settings">
            <BlogSettings />
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blog Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}