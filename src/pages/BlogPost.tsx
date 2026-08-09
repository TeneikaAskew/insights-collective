import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, User, ArrowLeft, Share2, Bookmark, Edit } from 'lucide-react';
import { getBlogPostBySlug, recordBlogPostView } from '@/services/blogService';
import { sanitizeHTML } from '@/utils/sanitize';
import { BlogPost } from '@/types/blog';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('BlogPostPage');

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isAdmin = user?.roles?.includes('admin');

  useEffect(() => {
    if (slug) {
      loadBlogPost(slug);
    }
  }, [slug]);

  const loadBlogPost = async (postSlug: string) => {
    try {
      setLoading(true);
      setLoadError(null);
      logger.log('Loading blog post with slug:', postSlug);
      const postData = await getBlogPostBySlug(postSlug);
      logger.log('Retrieved blog post data:', postData);
      if (!postData) {
        logger.log('No post data found for slug:', postSlug);
        setPost(null);
        setLoading(false);
        return;
      }
      setPost(postData);

      // Count the read. Deliberately not awaited and never surfaced: view
      // tracking is telemetry and must not delay or break rendering the post.
      if (postData.id) {
        void recordBlogPostView(postData.id, postSlug);
      }
    } catch (error: any) {
      // A fetch failure must not masquerade as "Blog post not found".
      logger.error('Error loading blog post:', error);
      setPost(null);
      setLoadError(error?.message || 'Failed to load this blog post.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.excerpt,
          url: url
        });
      } catch (error) {
        logger.log('Error sharing:', error);
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied!',
        description: 'The blog post link has been copied to your clipboard.',
      });
    }
  };

  const renderContent = (content: string) => {
    // Simple markdown to HTML conversion for better display
    let html = content
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mb-3 mt-6">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mb-4 mt-8">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mb-6 mt-10">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
      .replace(/~~(.*?)~~/gim, '<del class="line-through">$1</del>')
      .replace(/`([^`]+)`/gim, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-muted-foreground pl-4 italic my-4">$1</blockquote>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4" />')
      .replace(/^\* (.*$)/gim, '• $1')
      .replace(/^- (.*$)/gim, '• $1')
      .replace(/^\d+\. (.*$)/gim, '<span class="block">$1</span>')
      .replace(/\n\n/gim, '</p><p class="mb-4">')
      .replace(/\n/gim, '<br />');

    // Wrap with paragraph tags
    html = '<p class="mb-4">' + html + '</p>';

    return html;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8 px-4 max-w-4xl">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
            <div className="h-64 bg-muted rounded mb-6"></div>
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8 px-4 text-center" role="alert">
          <h1 className="text-2xl font-bold mb-2">Failed to load blog post</h1>
          <p className="text-muted-foreground mb-4">{loadError}</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => slug && loadBlogPost(slug)}>
              Retry
            </Button>
            <Link to="/blog">
              <Button>Back to Blog</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!post) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8 px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Blog post not found</h1>
          <Link to="/blog">
            <Button>Back to Blog</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageSeo
        title={`${post.seoTitle || post.title} | Insights Collective`}
        description={(post.seoDescription || post.excerpt || post.title).slice(0, 160)}
        path={`/blog/${post.slug}`}
        image={post.imageUrl}
        type="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.seoDescription || post.excerpt || undefined,
          image: post.imageUrl || undefined,
          datePublished: post.publishedAt || undefined,
          dateModified: post.updatedAt || post.publishedAt || undefined,
          author: post.authorName ? { '@type': 'Person', name: post.authorName } : undefined,
          mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
          publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        }}
      />
      <div className="container mx-auto py-8 px-4 max-w-4xl">

        {/* Navigation */}
        <div className="mb-6">
          <Link to="/blog">
            <Button variant="ghost" className="pl-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Blog
            </Button>
          </Link>
        </div>

        <article>
          {/* Header */}
          <header className="mb-8">
            {post.imageUrl && (
              <div className="mb-6 rounded-lg overflow-hidden">
                <img 
                  src={post.imageUrl} 
                  alt={post.title}
                  className="w-full h-64 md:h-80 object-cover"
                />
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline">{post.category}</Badge>
              {post.featured && (
                <Badge className="bg-ss-warn-chip text-ss-warn border-border">
                  Featured
                </Badge>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              {post.title}
            </h1>

            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              {post.excerpt}
            </p>

            {/* Meta Information */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-6">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{post.authorName}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(post.publishedAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{post.readTime} min read</span>
              </div>
              {post.views && (
                <div className="flex items-center gap-1">
                  <span>{post.views} views</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mb-8">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
               {isAdmin && (
                 <Link to={`/admin/blog/edit/${post.id}`}>
                   <Button variant="outline" size="sm">
                     <Edit className="h-4 w-4 mr-2" />
                     Edit Post
                   </Button>
                 </Link>
               )}
            </div>

            <Separator />
          </header>

          {/* Content */}
          <div className="prose prose-lg max-w-none mb-8">
            <div 
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(renderContent(post.content)) }}
              className="leading-relaxed"
            />
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {post.tags.map(tag => (
                  <Link
                    key={tag}
                    to={`/blog?tag=${encodeURIComponent(tag)}`}
                  >
                    <Badge 
                      variant="secondary" 
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Separator className="my-8" />

          {/* Footer */}
          <footer className="text-center">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Enjoyed this article?</h3>
              <p className="text-muted-foreground mb-4">
                Explore more insights on the blog
              </p>
              <Link to="/blog">
                <Button>
                  View All Articles
                </Button>
              </Link>
            </div>
          </footer>
        </article>
      </div>
    </AppLayout>
  );
}
