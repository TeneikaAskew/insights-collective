
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBlogPostBySlug } from '@/services/blogService';
import { BlogPost as BlogPostType } from '@/types/blog';
import AppLayout from '@/components/layout/AppLayout';
import ReactMarkdown from 'react-markdown';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, User, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;

  useEffect(() => {
    const fetchBlogPost = async () => {
      if (!slug) return;
      
      setIsLoading(true);
      try {
        const fetchedPost = await getBlogPostBySlug(slug);
        if (fetchedPost) {
          setPost(fetchedPost);
        } else {
          toast({
            title: "Error",
            description: "Blog post not found",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error fetching blog post:', error);
        toast({
          title: "Error",
          description: "Failed to load blog post",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlogPost();
  }, [slug]);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-12 px-4">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!post) {
    return (
      <AppLayout>
        <div className="container mx-auto py-12 px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">Post Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The blog post you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <Link to="/blog">Back to Blog</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            asChild
            className="mb-4 gap-2"
          >
            <Link to="/blog">
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Link>
          </Button>
          
          {post.imageUrl && (
            <div className="w-full h-[300px] sm:h-[400px] mb-6 overflow-hidden rounded-lg">
              <img
                src={post.imageUrl}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            {post.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground mb-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">{formatDate(post.publishedAt)}</span>
            </div>
            {post.authorName && (
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                <span className="text-sm">{post.authorName}</span>
              </div>
            )}
            {post.views !== undefined && (
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                <span className="text-sm">{post.views.toLocaleString()} views</span>
              </div>
            )}
            {post.readTime && (
              <div className="text-sm">
                {post.readTime} min read
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mb-6">
            {post.category && (
              <Badge variant="outline" className="bg-muted/50">
                {post.category}
              </Badge>
            )}
            {post.tags?.map(tag => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
          
          {isAdmin && (
            <div className="flex gap-2 mb-6">
              <Button variant="outline" asChild>
                <Link to={`/admin/blog/edit/${post.slug}`}>Edit Post</Link>
              </Button>
            </div>
          )}
          
          {post.excerpt && (
            <div className="text-lg text-muted-foreground mb-8 italic border-l-4 border-primary/20 pl-4 py-2">
              {post.excerpt}
            </div>
          )}
          
          <Separator className="my-8" />
          
          <div className="prose prose-lg max-w-none dark:prose-invert">
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </div>
          
          <Separator className="my-8" />
        </div>
      </div>
    </AppLayout>
  );
};

export default BlogPost;
