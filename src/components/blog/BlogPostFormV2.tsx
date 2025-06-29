import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Save, 
  Send, 
  Eye, 
  Clock, 
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Settings,
  FileText,
  Search,
  Share2,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BlogEditor } from './editor/BlogEditor';
import { SEOMetadataEditor } from './seo/SEOMetadataEditor';
import { TagInput } from './form/TagInput';
import { StatusDropdown } from './form/StatusDropdown';
import { Alert, AlertDescription } from '@/components/ui/alert';

const blogPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1, 'Content is required'),
  status: z.enum(['draft', 'published', 'scheduled']),
  category_id: z.string().optional(),
  tags: z.array(z.string()),
  meta_title: z.string().max(60).optional(),
  meta_description: z.string().max(160).optional(),
  meta_keywords: z.string().optional(),
  og_image: z.string().url().optional().or(z.literal('')),
  custom_slug: z.string().optional(),
  scheduled_at: z.date().optional(),
  is_featured: z.boolean().default(false),
  allow_comments: z.boolean().default(true),
});

type BlogPostFormData = z.infer<typeof blogPostSchema>;

interface BlogPostFormV2Props {
  postId?: string;
}

export function BlogPostFormV2({ postId }: BlogPostFormV2Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [readingTime, setReadingTime] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('content');

  const form = useForm<BlogPostFormData>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: {
      title: '',
      excerpt: '',
      content: '',
      status: 'draft',
      tags: [],
      is_featured: false,
      allow_comments: true,
    },
  });

  useEffect(() => {
    loadCategories();
    if (postId) {
      loadPost();
    }
  }, [postId]);

  useEffect(() => {
    const content = form.watch('content');
    const words = content.split(/\s+/).filter(word => word.length > 0).length;
    setWordCount(words);
    setReadingTime(Math.ceil(words / 200)); // Average reading speed: 200 words/min
  }, [form.watch('content')]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('blog_categories')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadPost = async () => {
    if (!postId) return;
    
    setLoading(true);
    try {
      const { data: post, error } = await supabase
        .from('blog_posts')
        .select(`
          *,
          blog_post_tags (
            tag_id,
            blog_tags (
              id,
              name,
              slug
            )
          )
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;
      if (!post) throw new Error('Post not found');

      // Set form values
      form.reset({
        title: post.title,
        excerpt: post.excerpt || '',
        content: post.content,
        status: post.status,
        category_id: post.category_id || undefined,
        tags: post.blog_post_tags?.map((pt: any) => pt.blog_tags.name) || [],
        meta_title: post.meta_title || '',
        meta_description: post.meta_description || '',
        meta_keywords: post.meta_keywords || '',
        og_image: post.og_image || '',
        custom_slug: post.custom_slug || '',
        scheduled_at: post.scheduled_at ? new Date(post.scheduled_at) : undefined,
        is_featured: post.is_featured || false,
        allow_comments: post.allow_comments ?? true,
      });

      setLastSaved(new Date(post.updated_at));
    } catch (error) {
      console.error('Error loading post:', error);
      toast({
        title: 'Error',
        description: 'Failed to load blog post',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: BlogPostFormData) => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      // Calculate reading time
      const words = data.content.split(/\s+/).filter(word => word.length > 0).length;
      const reading_time = Math.ceil(words / 200);

      // Prepare post data
      const postData = {
        title: data.title,
        excerpt: data.excerpt || null,
        content: data.content,
        status: data.status,
        category_id: data.category_id || null,
        reading_time,
        meta_title: data.meta_title || null,
        meta_description: data.meta_description || null,
        meta_keywords: data.meta_keywords || null,
        og_image: data.og_image || null,
        custom_slug: data.custom_slug || null,
        scheduled_at: data.scheduled_at?.toISOString() || null,
        is_featured: data.is_featured,
        allow_comments: data.allow_comments,
        published_at: data.status === 'published' ? new Date().toISOString() : null,
      };

      let resultPostId = postId;

      if (resultPostId) {
        // Update existing post
        const { error } = await supabase
          .from('blog_posts')
          .update({
            ...postData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);

        if (error) throw error;
      } else {
        // Create new post
        const { data: newPost, error } = await supabase
          .from('blog_posts')
          .insert({
            ...postData,
            author_id: userData.user.id,
          })
          .select()
          .single();

        if (error) throw error;
        postId = newPost.id;
      }

      // Handle tags
      if (postId && data.tags.length > 0) {
        // First, remove all existing tags
        await supabase
          .from('blog_post_tags')
          .delete()
          .eq('blog_post_id', postId);

        // Then add new tags
        const tagPromises = data.tags.map(async (tagName) => {
          // Check if tag exists
          let { data: tag } = await supabase
            .from('blog_tags')
            .select('id')
            .eq('name', tagName)
            .single();

          // Create tag if it doesn't exist
          if (!tag) {
            const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const { data: newTag } = await supabase
              .from('blog_tags')
              .insert({ name: tagName, slug })
              .select()
              .single();
            tag = newTag;
          }

          // Link tag to post
          if (tag) {
            await supabase
              .from('blog_post_tags')
              .insert({
                blog_post_id: postId,
                tag_id: tag.id,
              });
          }
        });

        await Promise.all(tagPromises);
      }

      // Create version history entry
      if (postId) {
        const { data: versions } = await supabase
          .from('blog_post_versions')
          .select('version_number')
          .eq('blog_post_id', postId)
          .order('version_number', { ascending: false })
          .limit(1);

        const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

        await supabase
          .from('blog_post_versions')
          .insert({
            blog_post_id: postId,
            title: data.title,
            content: data.content,
            excerpt: data.excerpt || null,
            version_number: nextVersion,
            created_by: userData.user.id,
          });
      }

      setLastSaved(new Date());
      toast({
        title: 'Success',
        description: postId ? 'Blog post updated successfully' : 'Blog post created successfully',
      });

      if (!postId && postId) {
        navigate(`/admin/blog/edit/${postId}`);
      }
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: 'Error',
        description: 'Failed to save blog post',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    const slug = form.getValues('custom_slug') || 
      form.getValues('title').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    window.open(`/blog/preview/${slug}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/blog')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {postId ? 'Edit Blog Post' : 'Create New Blog Post'}
              </h1>
              {lastSaved && (
                <p className="text-sm text-muted-foreground">
                  Last saved {format(lastSaved, 'MMM dd, yyyy at h:mm a')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              disabled={!form.getValues('content')}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <StatusDropdown
              status={form.watch('status')}
              onStatusChange={(value) => form.setValue('status', value)}
            />
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Content Stats */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            {wordCount} words
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {readingTime} min read
          </span>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="content">
              <FileText className="h-4 w-4 mr-2" />
              Content
            </TabsTrigger>
            <TabsTrigger value="seo">
              <Search className="h-4 w-4 mr-2" />
              SEO
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="analytics" disabled={!postId}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter blog post title" 
                      className="text-2xl font-semibold"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="excerpt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Excerpt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of your post (optional)"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A short summary that appears in blog listings
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <BlogEditor
                      content={field.value}
                      onChange={field.onChange}
                      placeholder="Start writing your blog post..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="seo">
            <SEOMetadataEditor
              metadata={{
                meta_title: form.watch('meta_title') || '',
                meta_description: form.watch('meta_description') || '',
                meta_keywords: form.watch('meta_keywords') || '',
                og_image: form.watch('og_image') || '',
                custom_slug: form.watch('custom_slug') || '',
              }}
              onChange={(metadata) => {
                form.setValue('meta_title', metadata.meta_title);
                form.setValue('meta_description', metadata.meta_description);
                form.setValue('meta_keywords', metadata.meta_keywords);
                form.setValue('og_image', metadata.og_image);
                form.setValue('custom_slug', metadata.custom_slug);
              }}
              title={form.watch('title')}
              content={form.watch('content')}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Post Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <TagInput
                          tags={field.value}
                          onTagsChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        Press Enter or comma to add tags
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('status') === 'scheduled' && (
                  <FormField
                    control={form.control}
                    name="scheduled_at"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Schedule Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'PPP p')
                                ) : (
                                  <span>Pick a date and time</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date()
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Post will be automatically published at this time
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="is_featured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Featured Post</FormLabel>
                        <FormDescription>
                          Display this post prominently on the blog homepage
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="allow_comments"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Allow Comments</FormLabel>
                        <FormDescription>
                          Let readers comment on this post
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            {postId ? (
              <div className="py-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Analytics will be available after the post is published.
                    You can view detailed analytics in the Analytics tab once your post starts receiving traffic.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="py-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Analytics are only available for saved posts.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
}