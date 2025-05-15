import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { getBlogPostBySlug, updateBlogPost } from '@/services/blogService';
import { BlogFormData, BlogPost } from '@/types/blog';
import { useToast } from '@/hooks/use-toast';
import BlogPostForm from '@/components/blog/BlogPostForm';

const EditBlogPost = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [blogPost, setBlogPost] = useState<BlogPost | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchBlogPost = async () => {
      if (!slug) return;
      
      setIsFetching(true);
      try {
        const post = await getBlogPostBySlug(slug);
        if (post) {
          setBlogPost(post);
        } else {
          toast({
            title: "Error",
            description: "Blog post not found",
            variant: "destructive"
          });
          navigate('/admin/blog');
        }
      } catch (error) {
        console.error('Error fetching blog post:', error);
        toast({
          title: "Error",
          description: "Failed to load blog post",
          variant: "destructive"
        });
      } finally {
        setIsFetching(false);
      }
    };

    fetchBlogPost();
  }, [slug, navigate]);

  const handleUpdatePost = async (data: BlogFormData) => {
    if (!slug) return;
    
    setIsLoading(true);
    try {
      const updatedPost = await updateBlogPost(slug, data);
      
      if (updatedPost) {
        toast({
          title: "Success",
          description: "Blog post updated successfully!"
        });
        // Navigate to the blog post page instead of the admin blog page
        navigate(`/blog/${updatedPost.slug}`);
      } else {
        throw new Error('Failed to update post');
      }
    } catch (error) {
      console.error('Error updating blog post:', error);
      toast({
        title: "Error",
        description: "Failed to update blog post",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center mb-6 gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/admin/blog')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog Admin
          </Button>
          <PageTitle title="Edit Blog Post" />
        </div>

        {isFetching ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : blogPost ? (
          <div className="bg-card border rounded-md">
            <BlogPostForm
              onSubmit={handleUpdatePost}
              isLoading={isLoading}
              initialData={{
                title: blogPost.title,
                content: blogPost.content,
                excerpt: blogPost.excerpt,
                slug: blogPost.slug,
                imageUrl: blogPost.imageUrl,
                tags: blogPost.tags,
                category: blogPost.category,
                status: blogPost.status,
                featured: blogPost.featured,
                seoTitle: blogPost.seoTitle,
                seoDescription: blogPost.seoDescription
              }}
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Blog post not found</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default EditBlogPost;
