
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage 
} from '@/components/ui/form';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
  Popover, PopoverContent, PopoverTrigger 
} from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, 
  AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Eye, EyeOff, FileCheck, FileX, SaveAll, Archive, Globe, Tag, Plus,
  X, CalendarIcon, Check, AlertTriangle, BookOpen, Clock, Info, Image
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { BlogPost, BlogFormData } from '@/types/blog';
import RichTextEditor from '@/components/ui/rich-text-editor';

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title is too long"),
  slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  excerpt: z.string().min(10, "Excerpt must be at least 10 characters").max(300, "Excerpt is too long"),
  content: z.string().min(50, "Content must be at least 50 characters"),
  imageUrl: z.string().url("Must be a valid URL").or(z.string().length(0)).optional(),
  tags: z.array(z.string()),
  category: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]),
  featured: z.boolean().default(false),
  seoTitle: z.string().max(60, "SEO title should be 60 characters or less").optional(),
  seoDescription: z.string().max(160, "SEO description should be 160 characters or less").optional(),
});

type BlogPostFormProps = {
  initialData?: BlogPost;
  onSubmit: (data: BlogFormData) => Promise<void>;
  isLoading: boolean;
};

const predefinedCategories = [
  "Data Science", 
  "Machine Learning", 
  "Programming", 
  "Career Insights", 
  "AI", 
  "Business Intelligence", 
  "Data Engineering", 
  "Analytics",
  "Industry Trends",
  "Tutorials",
  "Uncategorized"
];

const BlogPostForm = ({ initialData, onSubmit, isLoading }: BlogPostFormProps) => {
  const navigate = useNavigate();
  const [newTag, setNewTag] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [publishDate, setPublishDate] = useState<Date | undefined>(
    initialData?.publishedAt ? new Date(initialData.publishedAt) : undefined
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [seoScore, setSeoScore] = useState<number>(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || '',
      slug: initialData?.slug || '',
      excerpt: initialData?.excerpt || '',
      content: initialData?.content || '',
      imageUrl: initialData?.imageUrl || '',
      tags: initialData?.tags || [],
      category: initialData?.category || 'Uncategorized',
      status: initialData?.status || 'draft',
      featured: initialData?.featured || false,
      seoTitle: initialData?.seoTitle || '',
      seoDescription: initialData?.seoDescription || ''
    }
  });

  const { watch, setValue } = form;
  const title = watch('title');
  const content = watch('content');
  const seoTitle = watch('seoTitle');
  const seoDescription = watch('seoDescription');
  const tags = watch('tags');
  
  // Auto-generate slug from title
  useEffect(() => {
    if (title && !initialData?.slug) {
      const slug = title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, '-');
      setValue('slug', slug);
    }
  }, [title, setValue, initialData?.slug]);
  
  // Calculate read time
  useEffect(() => {
    if (!content) return;
    
    const wordsPerMinute = 200;
    const wordCount = content.trim().split(/\s+/).length;
    const readTime = Math.ceil(wordCount / wordsPerMinute);
    
    setReadTime(readTime);
  }, [content]);
  
  // Calculate SEO score
  useEffect(() => {
    let score = 0;
    const maxScore = 100;
    
    // Title checks
    if (title) {
      if (title.length >= 30 && title.length <= 60) score += 15;
      else if (title.length > 0) score += 5;
    }
    
    // Content checks
    if (content) {
      if (content.length >= 300) score += 15;
      else if (content.length > 0) score += 5;
      
      // Check for headings
      const headingsMatch = content.match(/#{2,3}\s+.+/g);
      if (headingsMatch && headingsMatch.length >= 2) score += 10;
      else if (headingsMatch && headingsMatch.length >= 1) score += 5;
      
      // Check for links
      const linksMatch = content.match(/\[.+\]\(.+\)/g);
      if (linksMatch && linksMatch.length >= 2) score += 5;
    }
    
    // SEO title and description
    if (seoTitle && seoTitle.length >= 30 && seoTitle.length <= 60) score += 15;
    if (seoDescription && seoDescription.length >= 70 && seoDescription.length <= 160) score += 15;
    
    // Image
    const imageUrl = watch('imageUrl');
    if (imageUrl) score += 10;
    
    // Tags
    if (tags && tags.length >= 3) score += 10;
    else if (tags && tags.length > 0) score += 5;
    
    // Slug
    const slug = watch('slug');
    if (slug && slug.includes(title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-').substring(0, 5))) score += 5;
    
    setSeoScore(Math.min(score, maxScore));
  }, [title, content, seoTitle, seoDescription, tags, watch]);

  const [readTime, setReadTime] = useState<number>(
    initialData?.readTime || 0
  );
  
  const [wordCount, setWordCount] = useState<number>(0);
  
  // Calculate word count
  useEffect(() => {
    if (!content) {
      setWordCount(0);
      return;
    }
    
    const plainText = content.replace(/(<([^>]+)>)/gi, '');
    const words = plainText.trim().split(/\s+/);
    setWordCount(words.length);
  }, [content]);

  const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      await onSubmit(data);
      toast({
        title: 'Success',
        description: `Blog post ${initialData ? 'updated' : 'created'} successfully!`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${initialData ? 'update' : 'create'} blog post.`,
        variant: 'destructive'
      });
    }
  };

  const addTag = () => {
    if (!newTag || newTag.trim() === '') return;
    
    const normalizedTag = newTag.trim();
    if (tags.includes(normalizedTag)) {
      toast({
        title: 'Duplicate Tag',
        description: 'This tag already exists',
        variant: 'destructive'
      });
      return;
    }
    
    setValue('tags', [...tags, normalizedTag]);
    setNewTag('');
  };

  const removeTag = (tagToRemove: string) => {
    setValue('tags', tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const getSeoScoreColor = () => {
    if (seoScore >= 80) return 'text-green-500';
    if (seoScore >= 50) return 'text-amber-500';
    return 'text-red-500';
  };
  
  const getSeoScoreLabel = () => {
    if (seoScore >= 80) return 'Good';
    if (seoScore >= 50) return 'Average';
    return 'Poor';
  };

  const getStatusBadge = () => {
    const status = form.watch('status');
    switch (status) {
      case 'published':
        return <Badge variant="success" className="bg-green-600">Published</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="w-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
          {/* Top controls bar */}
          <div className="sticky top-0 z-10 bg-background border-b py-4 px-4 -mx-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex items-center gap-2">
                <div>
                  {getStatusBadge()}
                </div>
                
                {initialData?.publishedAt && (
                  <div className="text-sm text-muted-foreground">
                    Published: {format(new Date(initialData.publishedAt), 'MMM d, yyyy')}
                  </div>
                )}
                
                {initialData?.updatedAt && initialData.updatedAt !== initialData.publishedAt && (
                  <div className="text-sm text-muted-foreground">
                    Updated: {format(new Date(initialData.updatedAt), 'MMM d, yyyy')}
                  </div>
                )}
                
                <div className="flex items-center ml-4">
                  <FormField
                    control={form.control}
                    name="featured"
                    render={({ field }) => (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="featured"
                          checked={field.value}
                          onChange={field.onChange}
                          className="rounded border-input h-4 w-4"
                        />
                        <label htmlFor="featured" className="text-sm font-medium">
                          Featured
                        </label>
                      </div>
                    )}
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      className="gap-1"
                    >
                      <Globe className="h-4 w-4" />
                      SEO: <span className={getSeoScoreColor()}>{getSeoScoreLabel()}</span>
                      <span className="ml-1 h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs">{seoScore}</span>
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4">
                    <div className="space-y-4">
                      <h4 className="font-medium">SEO Recommendations</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Title Length</span>
                          <span className={`text-sm ${(title.length >= 30 && title.length <= 60) ? 'text-green-500' : 'text-amber-500'}`}>
                            {title.length}/60
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Meta Description</span>
                          <span className={`text-sm ${(seoDescription && seoDescription.length >= 70 && seoDescription.length <= 160) ? 'text-green-500' : 'text-amber-500'}`}>
                            {seoDescription ? seoDescription.length : 0}/160
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Content Length</span>
                          <span className={`text-sm ${(wordCount >= 300) ? 'text-green-500' : 'text-amber-500'}`}>
                            {wordCount} words
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Featured Image</span>
                          {watch('imageUrl') ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Tags (min 3)</span>
                          <span className={`text-sm ${(tags.length >= 3) ? 'text-green-500' : 'text-amber-500'}`}>
                            {tags.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  className="gap-2"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  {previewMode ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Editor
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Preview
                    </>
                  )}
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      className="gap-2"
                    >
                      Status: {form.watch('status')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => form.setValue('status', 'draft')}>
                      <FileX className="h-4 w-4 mr-2" />
                      Draft
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => form.setValue('status', 'published')}>
                      <FileCheck className="h-4 w-4 mr-2" />
                      Published
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => form.setValue('status', 'archived')}>
                      <Archive className="h-4 w-4 mr-2" />
                      Archived
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" size="sm">
                      Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will lose all unsaved changes if you continue.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Go Back</AlertDialogCancel>
                      <AlertDialogAction onClick={() => navigate('/admin/blog')}>
                        Discard Changes
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <Button type="submit" size="sm" className="gap-2" disabled={isLoading}>
                  <SaveAll className="h-4 w-4" />
                  {isLoading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>

          {/* Main form content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Tabs defaultValue="content">
                <TabsList className="mb-4">
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="seo">SEO & Meta</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                
                <TabsContent value="content" className="space-y-6">
                  {/* Title */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter post title" 
                            {...field}
                            className="text-2xl font-bold py-3"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Slug */}
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <div className="flex items-center">
                          <span className="text-muted-foreground mr-1">/blog/</span>
                          <FormControl>
                            <Input placeholder="url-friendly-slug" {...field} />
                          </FormControl>
                        </div>
                        <FormDescription>
                          The URL-friendly version of the title
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Excerpt */}
                  <FormField
                    control={form.control}
                    name="excerpt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Excerpt</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            placeholder="Brief summary of the post"
                            className="w-full min-h-[100px] p-2 border rounded-md"
                          />
                        </FormControl>
                        <FormDescription>
                          A short summary that appears in blog listings (max 300 characters)
                          <span className="float-right">{field.value.length}/300</span>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Content */}
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content</FormLabel>
                        <FormControl>
                          <RichTextEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Write your blog post content here..."
                            minHeight="400px"
                          />
                        </FormControl>
                        <FormDescription className="flex justify-between">
                          <span>Use markdown to format your content</span>
                          <span>{wordCount} words • {readTime} min read</span>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                <TabsContent value="seo" className="space-y-6">
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Featured Image URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/image.jpg" {...field} />
                        </FormControl>
                        <FormDescription>
                          The main image for your blog post
                        </FormDescription>
                        <FormMessage />
                        {field.value && (
                          <div className="mt-2 relative aspect-video rounded-md overflow-hidden">
                            <img 
                              src={field.value} 
                              alt="Featured" 
                              className="object-cover w-full h-full" 
                              onError={(e) => {
                                e.currentTarget.src = 'https://via.placeholder.com/800x450?text=Image+Not+Found';
                              }}
                            />
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="seoTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SEO Title</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="SEO-optimized title (defaults to post title if empty)" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription className="flex justify-between">
                          <span>Title that appears in search results</span>
                          <span className={field.value.length > 60 ? 'text-red-500' : ''}>
                            {field.value.length}/60
                          </span>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="seoDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta Description</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            placeholder="Brief description for search engines"
                            className="w-full min-h-[100px] p-2 border rounded-md"
                          />
                        </FormControl>
                        <FormDescription className="flex justify-between">
                          <span>Description that appears in search results</span>
                          <span className={field.value.length > 160 ? 'text-red-500' : ''}>
                            {field.value.length}/160
                          </span>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Search Result Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="border p-4 rounded-md bg-card">
                        <div className="text-blue-600 text-lg line-clamp-1 font-medium">
                          {seoTitle || title || "Page Title"}
                        </div>
                        <div className="text-green-700 text-sm line-clamp-1">
                          {window.location.origin}/blog/{form.watch('slug') || "page-url"}
                        </div>
                        <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {seoDescription || form.watch('excerpt') || "Meta description appears here..."}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="preview">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="prose max-w-none">
                        <h1>{title}</h1>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {tags.map(tag => (
                            <Badge key={tag} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                        <div className="text-sm text-muted-foreground mb-4">
                          <span>{readTime} min read</span>
                          <span className="mx-2">•</span>
                          <span>Category: {form.watch('category')}</span>
                        </div>
                        {form.watch('imageUrl') && (
                          <img 
                            src={form.watch('imageUrl')} 
                            alt={title}
                            className="w-full h-auto rounded-md mb-6"
                          />
                        )}
                        <ReactMarkdown>
                          {content}
                        </ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            <div>
              <div className="space-y-6 sticky top-28">
                {/* Post Settings - Category */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Category</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <Select 
                            value={field.value} 
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                              {predefinedCategories.map(category => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
                
                {/* Post Settings - Tags */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center">
                      <Tag className="h-4 w-4 mr-2" />
                      Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <FormField
                      control={form.control}
                      name="tags"
                      render={() => (
                        <FormItem>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="gap-1">
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeTag(tag)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyDown={handleKeyDown}
                              placeholder="Add a tag..."
                              className="flex-1"
                            />
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={addTag}
                              disabled={!newTag}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
                
                {/* Post Settings - Publish Date */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Publishing</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select 
                              value={field.value} 
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">
                                  <div className="flex items-center">
                                    <FileX className="h-4 w-4 mr-2" />
                                    Draft
                                  </div>
                                </SelectItem>
                                <SelectItem value="published">
                                  <div className="flex items-center">
                                    <FileCheck className="h-4 w-4 mr-2" />
                                    Published
                                  </div>
                                </SelectItem>
                                <SelectItem value="archived">
                                  <div className="flex items-center">
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archived
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Publish Date</span>
                        <div className="flex items-center">
                          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-[240px] justify-start text-left font-normal"
                                type="button"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {publishDate ? format(publishDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={publishDate}
                                onSelect={(date) => {
                                  setPublishDate(date);
                                  setIsDatePickerOpen(false);
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Post Settings - Stats */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <div className="text-sm flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          Reading Time
                        </div>
                        <span className="text-sm font-medium">{readTime} min</span>
                      </div>
                      <div className="flex justify-between">
                        <div className="text-sm flex items-center">
                          <BookOpen className="h-4 w-4 mr-2" />
                          Word Count
                        </div>
                        <span className="text-sm font-medium">{wordCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <div className="text-sm flex items-center">
                          <Info className="h-4 w-4 mr-2" />
                          SEO Score
                        </div>
                        <span className={`text-sm font-medium ${getSeoScoreColor()}`}>
                          {seoScore}/100
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Post Settings - Featured Image Preview */}
                {form.watch('imageUrl') && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Featured Image</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="relative aspect-video rounded-md overflow-hidden">
                        <img 
                          src={form.watch('imageUrl')} 
                          alt="Featured" 
                          className="object-cover w-full h-full" 
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default BlogPostForm;
