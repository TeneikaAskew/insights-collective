
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { BlogFormData } from '@/types/blog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Tag, Plus, Save, Eye, Settings, FileText, ChevronDown, Image } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { toast } from '@/hooks/use-toast';

// Define the form schema with Zod
const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().min(1, 'Excerpt is required'),
  slug: z.string().min(1, 'Slug is required'),
  imageUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  featured: z.boolean().default(false),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

// Props interface
interface BlogPostFormProps {
  onSubmit: (data: BlogFormData) => void;
  isLoading: boolean;
  initialData?: Partial<BlogFormData>;
}

const BlogPostForm: React.FC<BlogPostFormProps> = ({ 
  onSubmit, 
  isLoading,
  initialData 
}) => {
  const [activeTab, setActiveTab] = useState('edit');
  const [tagInput, setTagInput] = useState('');
  const [showImagePreview, setShowImagePreview] = useState(false);
  const { uploadFile, uploading } = useStorageUpload();

  // Initialize form with default values or initialData if provided
  const form = useForm<BlogFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || '',
      content: initialData?.content || '',
      excerpt: initialData?.excerpt || '',
      slug: initialData?.slug || '',
      imageUrl: initialData?.imageUrl || '',
      tags: initialData?.tags || [],
      category: initialData?.category || '',
      status: initialData?.status || 'draft',
      featured: initialData?.featured || false,
      seoTitle: initialData?.seoTitle || '',
      seoDescription: initialData?.seoDescription || '',
    },
  });

  // Watch content field for preview
  const content = form.watch('content');
  const title = form.watch('title');
  const imageUrl = form.watch('imageUrl');

  // Handler for form submission
  const handleFormSubmit = (data: BlogFormData) => {
    onSubmit(data);
  };

  // Add a tag to the list
  const addTag = () => {
    if (tagInput.trim() && !form.getValues('tags').includes(tagInput.trim())) {
      const currentTags = form.getValues('tags');
      form.setValue('tags', [...currentTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  // Remove a tag from the list
  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues('tags');
    form.setValue(
      'tags',
      currentTags.filter(tag => tag !== tagToRemove)
    );
  };

  // Generate slug from title
  const generateSlug = () => {
    const titleValue = form.getValues('title');
    if (titleValue) {
      const slug = titleValue
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      form.setValue('slug', slug);
    }
  };

  // Auto-generate slug when title changes (only if slug is empty or user hasn't modified it)
  useEffect(() => {
    const subscription = form.watch(({ title }, { name }) => {
      if (name === 'title' && (!form.getValues('slug') || form.getValues('slug') === '')) {
        const slug = title
          ?.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
        if (slug) form.setValue('slug', slug);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Use the SEO title from the main title if not specified
  useEffect(() => {
    const subscription = form.watch(({ title, seoTitle }) => {
      if (title && !seoTitle) {
        form.setValue('seoTitle', title);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Toggle image preview
  const toggleImagePreview = () => {
    setShowImagePreview(prev => !prev);
  };

  return (
    <div className="p-6">
      <Tabs
        defaultValue="edit"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <div className="flex justify-between items-center mb-6">
          <TabsList>
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  {form.getValues('status') === 'published' ? 'Published' : 
                   form.getValues('status') === 'draft' ? 'Draft' : 'Archived'}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => form.setValue('status', 'published')}>
                  Publish
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => form.setValue('status', 'draft')}>
                  Save as Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => form.setValue('status', 'archived')}>
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              type="submit" 
              form="blogPostForm"
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-b-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {initialData ? 'Update Post' : 'Create Post'}
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form 
            id="blogPostForm" 
            onSubmit={form.handleSubmit(handleFormSubmit)} 
            className="space-y-6"
          >
            <TabsContent value="edit" className="space-y-6 mt-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter blog post title" 
                        {...field}
                        className="text-lg font-semibold" 
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
                        placeholder="Write a brief summary of your blog post" 
                        rows={2}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content (Markdown)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Write your blog post content in Markdown format" 
                        className="min-h-[300px] font-mono"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col sm:flex-row gap-6">
                <div className="w-full sm:w-1/2">
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between">
                          <FormLabel>Slug</FormLabel>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-xs"
                            onClick={generateSlug}
                          >
                            Generate from title
                          </Button>
                        </div>
                        <FormControl>
                          <Input placeholder="blog-post-url-slug" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="w-full sm:w-1/2">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Fundamentals">Fundamentals</SelectItem>
                            <SelectItem value="Career">Career</SelectItem>
                            <SelectItem value="Technical">Technical</SelectItem>
                            <SelectItem value="Industry">Industry</SelectItem>
                            <SelectItem value="Case Studies">Case Studies</SelectItem>
                            <SelectItem value="Tools">Tools</SelectItem>
                            <SelectItem value="Ethics">Ethics</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormItem>
                <FormLabel>Tags</FormLabel>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.getValues('tags').map((tag, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-muted-foreground hover:text-foreground ml-1"
                      >
                        &times;
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add a tag"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={addTag}
                    variant="outline"
                    size="icon"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </FormItem>

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel>Featured Image URL</FormLabel>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={toggleImagePreview}
                      >
                        {showImagePreview ? 'Hide Preview' : 'Show Preview'}
                      </Button>
                    </div>
                    <FormControl>
                      <Input 
                        placeholder="https://example.com/image.jpg" 
                        {...field} 
                      />
                    </FormControl>
                    {showImagePreview && imageUrl && (
                      <div className="mt-2 border rounded-md overflow-hidden">
                        <img 
                          src={imageUrl} 
                          alt="Preview" 
                          className="max-h-64 object-cover w-full"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/placeholder.svg';
                            toast({
                              title: "Image Error",
                              description: "Could not load image. Please check the URL.",
                              variant: "destructive"
                            });
                          }}
                        />
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value="preview" className="mt-6">
              <Card className="bg-background">
                <CardContent className="p-6">
                  {imageUrl && (
                    <div className="w-full h-[250px] mb-6 rounded-lg overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder.svg';
                        }}
                      />
                    </div>
                  )}
                  <div className="prose max-w-none dark:prose-invert">
                    <h1 className="text-3xl font-bold mb-4">{title}</h1>
                    <div className="mt-6">
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6 mt-6">
              <FormField
                control={form.control}
                name="featured"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Featured Post
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Display this post prominently on the blog homepage
                      </p>
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

              <div className="space-y-4">
                <h3 className="text-lg font-medium">SEO Settings</h3>
                
                <FormField
                  control={form.control}
                  name="seoTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SEO Title</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="SEO optimized title (defaults to post title)" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="seoDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SEO Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description for search engines" 
                          {...field} 
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>
          </form>
        </Form>
      </Tabs>
    </div>
  );
};

export default BlogPostForm;
