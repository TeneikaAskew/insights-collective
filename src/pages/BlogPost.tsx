
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Tag, Edit, AlertCircle, 
  ThumbsUp, Share2, Bookmark, MessageSquare, Clock,
  Eye, Twitter, Facebook, Linkedin, Copy, Check, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import AppLayout from '@/components/layout/AppLayout';
import { BlogPost as BlogPostType } from '@/types/blog';
import { getBlogPostBySlug, getAllBlogPosts } from '@/services/blogService';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPostType[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const [activeTOCSection, setActiveTOCSection] = useState<string | null>(null);
  const { isAuthenticated, isAdminAuthenticated } = useAuth();

  useEffect(() => {
    if (!slug) return;
    
    fetchBlogPost();
    // Track page view
    window.scrollTo(0, 0);
  }, [slug]);

  const fetchBlogPost = async () => {
    if (!slug) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const fetchedPost = await getBlogPostBySlug(slug);
      
      if (fetchedPost) {
        setPost(fetchedPost);
        fetchRelatedPosts(fetchedPost);
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

  const fetchRelatedPosts = async (currentPost: BlogPostType) => {
    try {
      const allPosts = await getAllBlogPosts();
      
      // Filter out current post and get posts with same category or at least one common tag
      let filtered = allPosts.filter(post => 
        post.id !== currentPost.id && 
        post.status === 'published' &&
        (
          post.category === currentPost.category || 
          (post.tags && currentPost.tags && 
            post.tags.some(tag => currentPost.tags.includes(tag)))
        )
      );
      
      // If we have less than 3 related posts, just get the most recent ones
      if (filtered.length < 3) {
        filtered = allPosts
          .filter(post => post.id !== currentPost.id && post.status === 'published')
          .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      }
      
      setRelatedPosts(filtered.slice(0, 3));
    } catch (error) {
      console.error('Error fetching related posts:', error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setHasShared(true);
    toast({
      title: "Link Copied",
      description: "Link copied to clipboard"
    });
    setTimeout(() => setHasShared(false), 2000);
  };
  
  const handleLike = () => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to like this article",
        variant: "destructive"
      });
      return;
    }
    
    setIsLiked(!isLiked);
    toast({
      title: isLiked ? "Removed Like" : "Added Like",
      description: isLiked ? "You've removed your like" : "You've liked this article"
    });
  };
  
  const handleSave = () => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save this article",
        variant: "destructive"
      });
      return;
    }
    
    setIsSaved(!isSaved);
    toast({
      title: isSaved ? "Removed from Saved" : "Saved",
      description: isSaved 
        ? "Article removed from your saved list" 
        : "Article saved to your reading list"
    });
  };
  
  const handleShareClick = (platform: string) => {
    let shareUrl = '';
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(post?.title || 'Check out this blog post');
    
    switch(platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}`;
        break;
      default:
        return;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
    setHasShared(true);
    setTimeout(() => setHasShared(false), 2000);
  };
  
  const extractTableOfContents = (content: string) => {
    const headingRegex = /^#{2,3}\s+(.+)/gm;
    const toc: {id: string, text: string, level: number}[] = [];
    
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      const headingText = match[1];
      const level = match[0].startsWith('### ') ? 3 : 2;
      const id = headingText.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
      toc.push({
        id,
        text: headingText,
        level
      });
    }
    
    return toc;
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

  const tableOfContents = extractTableOfContents(post.content);

  // Replace markdown headings with custom id'd headings for ToC
  const contentWithIds = post.content.replace(/^(#{2,3})\s+(.+)/gm, (match, hashes, title) => {
    const id = title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
    return `${hashes} <a id="${id}" className="anchor"></a>${title}`;
  });

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto py-8 px-4">
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
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            {/* Post Header */}
            <div className="mb-8">
              <Badge variant="outline" className="mb-4">
                {post.category || 'Uncategorized'}
              </Badge>
              <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
              
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDate(post.publishedAt)}
                </div>
                
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {post.readTime} min read
                </div>
                
                <div className="flex items-center">
                  <Eye className="h-4 w-4 mr-1" />
                  {post.views?.toLocaleString() || '0'} views
                </div>
                
                {post.authorName && (
                  <div>
                    By {post.authorName}
                  </div>
                )}
              </div>
              
              {/* Post Actions */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  variant={isLiked ? "default" : "outline"} 
                  size="sm"
                  onClick={handleLike}
                  className="gap-2"
                >
                  <ThumbsUp className="h-4 w-4" />
                  {isLiked ? 'Liked' : 'Like'}
                </Button>
                
                <Button 
                  variant={isSaved ? "default" : "outline"} 
                  size="sm"
                  onClick={handleSave}
                  className="gap-2"
                >
                  <Bookmark className="h-4 w-4" />
                  {isSaved ? 'Saved' : 'Save'}
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant={hasShared ? "default" : "outline"} 
                      size="sm"
                      className="gap-2"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleShareClick('twitter')}>
                      <Twitter className="h-4 w-4 mr-2" />
                      Share on Twitter
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShareClick('facebook')}>
                      <Facebook className="h-4 w-4 mr-2" />
                      Share on Facebook
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShareClick('linkedin')}>
                      <Linkedin className="h-4 w-4 mr-2" />
                      Share on LinkedIn
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyLink}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                {post.tags.map(tag => (
                  <Link key={tag} to={`/blog?tag=${tag}`}>
                    <Badge variant="outline">{tag}</Badge>
                  </Link>
                ))}
              </div>
            )}
            
            <Separator className="mb-8" />
            
            {/* Blog Content Tabs */}
            <Tabs defaultValue="article" className="mb-8">
              <TabsList className="mb-4">
                <TabsTrigger value="article">Article</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
              </TabsList>
              <TabsContent value="article">
                {/* Content */}
                <div className="prose prose-lg max-w-none">
                  <ReactMarkdown>
                    {contentWithIds}
                  </ReactMarkdown>
                </div>
              </TabsContent>
              <TabsContent value="comments">
                <div className="rounded-lg border p-6">
                  <div className="flex items-center justify-center py-12 flex-col">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Join the Conversation</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Log in to comment and discuss this article with the community.
                    </p>
                    <Button>Sign In to Comment</Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <Separator className="my-8" />
            
            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Related Articles</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedPosts.map((relatedPost) => (
                    <Card key={relatedPost.id}>
                      {relatedPost.imageUrl && (
                        <div className="h-36 overflow-hidden">
                          <img 
                            src={relatedPost.imageUrl} 
                            alt={relatedPost.title} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardContent className="pt-4">
                        <h3 className="font-bold hover:text-primary transition-colors line-clamp-2">
                          <Link to={`/blog/${relatedPost.slug}`}>
                            {relatedPost.title}
                          </Link>
                        </h3>
                        <div className="flex items-center text-xs text-muted-foreground mt-2">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(relatedPost.publishedAt)}
                          <Separator orientation="vertical" className="mx-2 h-3" />
                          <Clock className="h-3 w-3 mr-1" />
                          {relatedPost.readTime} min read
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" asChild>
                <Link to="/blog">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  All Articles
                </Link>
              </Button>
              
              <Button asChild>
                <Link to="/data-blueprint">
                  Data Blueprint Series
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Table of Contents */}
            {tableOfContents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {tableOfContents.map((item, idx) => (
                      <div key={idx} className={`pl-${(item.level-2)*4}`}>
                        <a 
                          href={`#${item.id}`} 
                          className={`block py-1 text-sm hover:text-primary transition-colors ${
                            activeTOCSection === item.id ? 'font-medium text-primary' : 'text-muted-foreground'
                          }`}
                          onClick={() => setActiveTOCSection(item.id)}
                        >
                          {item.text}
                        </a>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Author Info */}
            {post.authorName && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About the Author</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      {post.authorName.charAt(0)}
                    </div>
                    <div className="ml-4">
                      <p className="font-medium">{post.authorName}</p>
                      <p className="text-sm text-muted-foreground">Data Expert</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Popular Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Popular Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {post.tags && post.tags.map((tag) => (
                    <Badge 
                      key={tag}
                      variant="outline"
                      className="cursor-pointer"
                    >
                      <Link to={`/blog?tag=${tag}`}>
                        {tag}
                      </Link>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Newsletter Signup */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Subscribe to Our Newsletter</CardTitle>
                <CardDescription>
                  Get the latest data science insights delivered to your inbox
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <input 
                      type="email" 
                      placeholder="your@email.com" 
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <Button className="w-full">Subscribe</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default BlogPost;
