
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import BlogPostForm from '@/components/blog/BlogPostForm';
import { BlogFormData, BlogPost } from '@/types/blog';
import { getBlogPostBySlug, createBlogPost, updateBlogPost } from '@/services/blogService';
import { useToast } from '@/hooks/use-toast';

export default function BlogPostEditor() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [initialData, setInitialData] = useState<Partial<BlogFormData> | undefined>();
  const [isEditMode] = useState(!!slug);

  useEffect(() => {
    if (slug) {
      loadBlogPost();
    }
  }, [slug]);

  const loadBlogPost = async () => {
    if (!slug) return;
    
    try {
      setIsLoading(true);
      const post = await getBlogPostBySlug(slug);
      if (post) {
        setInitialData({
          title: post.title,
          content: post.content,
          excerpt: post.excerpt,
          slug: post.slug,
          imageUrl: post.imageUrl || '',
          tags: post.tags || [],
          category: post.category,
          status: post.status,
          featured: post.featured,
          seoTitle: post.seoTitle || '',
          seoDescription: post.seoDescription || '',
        });
      }
    } catch (error) {
      console.error('Error loading blog post:', error);
      toast({
        title: 'Error',
        description: 'Failed to load blog post',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: BlogFormData) => {
    try {
      setIsLoading(true);
      
      if (isEditMode && slug) {
        await updateBlogPost(slug, data);
        toast({
          title: 'Success',
          description: 'Blog post updated successfully',
        });
      } else {
        await createBlogPost(data);
        toast({
          title: 'Success', 
          description: 'Blog post created successfully',
        });
        navigate('/admin/blog');
      }
    } catch (error) {
      console.error('Error saving blog post:', error);
      toast({
        title: 'Error',
        description: 'Failed to save blog post',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/blog')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog Management
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEditMode ? 'Edit Blog Post' : 'Create New Blog Post'}
            </h1>
            <p className="text-gray-600">
              {isEditMode ? 'Update your blog post' : 'Create a new blog post for the Data Blueprint Series'}
            </p>
          </div>
        </div>
      </div>

      <BlogPostForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        initialData={initialData}
      />
    </div>
  );
}
