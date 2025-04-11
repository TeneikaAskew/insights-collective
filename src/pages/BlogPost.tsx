
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Tag, Edit, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/components/layout/AppLayout';
import { BlogPost as BlogPostType } from '@/types/blog';
import { getBlogPostBySlug } from '@/services/blogService';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, isAdminAuthenticated } = useAuth();

  useEffect(() => {
    const fetchBlogPost = async () => {
      if (!slug) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const fetchedPost = await getBlogPostBySlug(slug);
        
        if (fetchedPost) {
          setPost(fetchedPost);
        } else {
          setError('Blog post not found');
          navigate('/blog', { replace: true });
        }
      } catch (error) {
        console.error('Error fetching blog post:', error);
        setError('Failed to load blog post');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlogPost();
  }, [slug, navigate]);

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
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !post) {
    return (
      <AppLayout>
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Error Loading Post</h2>
            <p className="text-muted-foreground mb-6">{error || 'Blog post not found'}</p>
            <Button asChild>
              <Link to="/blog">Return to Blog</Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Back Button and Admin Edit */}
        <div className="flex justify-between items-center mb-8">
          <Button variant="ghost" asChild className="pl-0">
            <Link to="/blog" className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Link>
          </Button>
          
          {(isAuthenticated && isAdminAuthenticated) && (
            <Button variant="outline" asChild>
              <Link to={`/admin/blog/edit/${post.slug}`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Post
              </Link>
            </Button>
          )}
        </div>
        
        {/* Post Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
          
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              {formatDate(post.publishedAt)}
            </div>
            
            {post.authorName && (
              <div>
                By {post.authorName}
              </div>
            )}
          </div>
        </div>
        
        {/* Featured Image */}
        {post.imageUrl && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img 
              src={post.imageUrl} 
              alt={post.title} 
              className="w-full object-cover" 
            />
          </div>
        )}
        
        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mb-6 flex items-center">
            <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <Link key={tag} to={`/blog?tag=${tag}`}>
                  <Badge variant="outline">{tag}</Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        <Separator className="mb-8" />
        
        {/* Blog Content */}
        <div className="prose prose-lg max-w-none">
          <ReactMarkdown>
            {post.content}
          </ReactMarkdown>
        </div>
        
        <Separator className="my-8" />
        
        {/* Related Posts or Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" asChild>
            <Link to="/data-blueprint">
              Data Blueprint Series
            </Link>
          </Button>
          
          <Button asChild>
            <Link to="/blog">
              More Articles
            </Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default BlogPost;
