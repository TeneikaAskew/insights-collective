import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Save, Tag, X, ArrowLeft, FileImage } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createBlogPost } from '@/services/blogService';
import ReactMarkdown from 'react-markdown';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { BlogPost } from '@/types/blog';

const formSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  slug: z.string().min(3, { message: "Slug must be at least 3 characters" })
    .regex(/^[a-z0-9-]+$/, { message: "Slug can only contain lowercase letters, numbers, and hyphens" }),
  excerpt: z.string().min(10, { message: "Excerpt must be at least 10 characters" }),
  content: z.string().min(50, { message: "Content must be at least 50 characters" }),
  imageUrl: z.string().url({ message: "Image URL must be valid" }).optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema> & { tags: string[] };

const CreateBlogPost = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      imageUrl: '',
      tags: [],
    },
  });

  const generateSlug = () => {
    const title = form.getValues('title');
    if (title) {
      const slug = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')  // Remove special characters
        .replace(/\s+/g, '-')      // Replace spaces with hyphens
        .replace(/--+/g, '-')      // Replace multiple hyphens with single
        .trim();
      
      form.setValue('slug', slug);
    }
  };

  const addTag = () => {
    if (tagInput && !tags.includes(tagInput) && tags.length < 5) {
      const newTags = [...tags, tagInput];
      setTags(newTags);
      form.setValue('tags', newTags);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);
    form.setValue('tags', newTags);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    try {
      // Create the blog post with required fields properly defined
      const blogPost = await createBlogPost({
        title: data.title,
        content: data.content,
        excerpt: data.excerpt,
        slug: data.slug,
        imageUrl: data.imageUrl,
        publishedAt: new Date().toISOString(),
        authorId: user?.id,
        authorName: user?.email?.split('@')[0] || 'Admin',
        tags: tags
      });

      if (blogPost) {
        toast({
          title: "Success",
          description: "Blog post published successfully",
        });
        navigate(`/blog/${blogPost.slug}`);
      } else {
        throw new Error("Failed to publish blog post");
      }
    } catch (error) {
      console.error("Error creating blog post:", error);
      toast({
        title: "Error",
        description: "Failed to publish blog post",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <Button variant="ghost" className="pl-0" onClick={() => navigate('/admin/blog')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Posts
          </Button>
        </div>
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Create New Blog Post</h1>
            <p className="text-muted-foreground mt-1">
              Write and publish a new article
            </p>
          </div>
          
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Publishing...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Publish Post
              </>
            )}
          </Button>
        </div>
        
        <Form {...form}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Title and Content */}
              <Card>
                <CardContent className="p-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="mb-6">
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter post title" 
                            {...field} 
                            className="text-lg"
                            onBlur={() => {
                              if (!form.getValues('slug')) {
                                generateSlug();
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Tabs defaultValue="write" onValueChange={(value) => setActiveTab(value as 'write' | 'preview')}>
                    <TabsList className="mb-4">
                      <TabsTrigger value="write">Write</TabsTrigger>
                      <TabsTrigger value="preview">Preview</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="write" className="space-y-4">
                      <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Content (Markdown)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Write your post content using Markdown..." 
                                className="min-h-[400px] font-mono"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                    
                    <TabsContent value="preview" className="border rounded-md p-4 min-h-[400px]">
                      <div className="prose prose-sm max-w-none">
                        {activeTab === 'preview' && form.getValues('content') ? (
                          <ReactMarkdown>
                            {form.getValues('content')}
                          </ReactMarkdown>
                        ) : (
                          <div className="text-muted-foreground text-center py-12">
                            Content preview will appear here
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-6">
              {/* Metadata Card */}
              <Card>
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Post Details</h3>
                    
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem className="mb-4">
                          <FormLabel>Slug</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input 
                                placeholder="post-url-slug" 
                                {...field} 
                              />
                            </FormControl>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm"
                              onClick={generateSlug}
                            >
                              Generate
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="excerpt"
                      render={({ field }) => (
                        <FormItem className="mb-4">
                          <FormLabel>Excerpt</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Brief summary of the post..." 
                              className="resize-none"
                              rows={3}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Featured Image URL</FormLabel>
                          <div className="flex gap-2 items-start">
                            <div className="flex-grow">
                              <FormControl>
                                <Input 
                                  placeholder="https://example.com/image.jpg" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </div>
                            {field.value && (
                              <div className="h-10 w-10 rounded overflow-hidden border flex-shrink-0">
                                <img 
                                  src={field.value} 
                                  alt="Preview" 
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Separator />
                  
                  {/* Tags */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center">
                      <Tag className="h-4 w-4 mr-2" />
                      Tags
                    </h4>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      {tags.map(tag => (
                        <Badge key={tag} className="flex items-center gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-xs rounded-full hover:bg-primary/20 p-1"
                          >
                            <X className="h-3 w-3" />
                            <span className="sr-only">Remove {tag}</span>
                          </button>
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add tag..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-grow"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={addTag}
                        disabled={!tagInput || tags.length >= 5}
                      >
                        Add
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {tags.length}/5 tags
                    </p>
                  </div>
                  
                  <Separator />
                  
                  {/* Publishing Info */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      Publishing
                    </h4>
                    
                    <div className="bg-muted/50 rounded p-3 text-sm">
                      <p>
                        <span className="font-medium">Publish Date:</span>{' '}
                        {format(new Date(), 'MMMM d, yyyy')}
                      </p>
                      <p>
                        <span className="font-medium">Author:</span>{' '}
                        {user?.email?.split('@')[0] || 'Admin'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </Form>
      </div>
    </AppLayout>
  );
};

export default CreateBlogPost;
