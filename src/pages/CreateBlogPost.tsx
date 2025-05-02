
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import PageTitle from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { createBlogPost } from '@/services/blogService';
import { BlogFormData } from '@/types/blog';
import { toast } from '@/hooks/use-toast';
import BlogPostForm from '@/components/blog/BlogPostForm';

const CreateBlogPost = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleCreatePost = async (data: BlogFormData) => {
    setIsLoading(true);
    try {
      const newPost = await createBlogPost(data);
      
      if (newPost) {
        toast({
          title: "Success",
          description: "Blog post created successfully!"
        });
        navigate('/admin/blog');
      } else {
        throw new Error('Failed to create post');
      }
    } catch (error) {
      console.error('Error creating blog post:', error);
      toast({
        title: "Error",
        description: "Failed to create blog post",
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
          <PageTitle>Create New Blog Post</PageTitle>
        </div>

        <div className="bg-card border rounded-md">
          <BlogPostForm
            onSubmit={handleCreatePost}
            isLoading={isLoading}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateBlogPost;
