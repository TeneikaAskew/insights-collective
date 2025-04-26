
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useThreadPosts, useCreatePost, useThreadSubscription, useMarkThreadAsRead } from '@/hooks/useForums';
import { MessageSquare, Reply, Bell, BellOff, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Thread, Post } from '@/types/forum';
import { useAuth } from '@/contexts/AuthContext';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

interface ThreadDetailProps {
  thread: Thread;
  courseName?: string;
  forumName?: string;
}

const PostItem: React.FC<{
  post: Post;
  isFirstPost?: boolean;
  onReply: (postId: string) => void;
}> = ({ post, isFirstPost = false, onReply }) => {
  const [showReplies, setShowReplies] = useState(true);
  
  return (
    <div className="mb-4">
      <Card className={isFirstPost ? "border-primary/50" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarImage src={post.author?.avatar_url || ''} />
                <AvatarFallback>
                  {post.author ? 
                    `${post.author.first_name?.[0] || ''}${post.author.last_name?.[0] || ''}` : 
                    'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">
                  {post.author ? 
                    `${post.author.first_name || ''} ${post.author.last_name || ''}` : 
                    'Unknown User'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(post.created_at).toLocaleString()}
                </div>
              </div>
            </div>
            {isFirstPost && <Badge>Original Post</Badge>}
          </div>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </CardContent>
        <CardFooter className="pt-2 pb-4 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {post.updated_at !== post.created_at && 
              `Edited on ${new Date(post.updated_at).toLocaleDateString()}`}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onReply(post.id)}>
            <Reply className="h-4 w-4 mr-1" />
            Reply
          </Button>
        </CardFooter>
      </Card>
      
      {post.replies && post.replies.length > 0 && (
        <div className="mt-2 pl-6 border-l-2">
          <div className="flex items-center mb-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2"
              onClick={() => setShowReplies(!showReplies)}
            >
              {showReplies ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide Replies
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show {post.replies.length} Replies
                </>
              )}
            </Button>
          </div>
          
          {showReplies && (
            <div className="space-y-3">
              {post.replies.map((reply) => (
                <PostItem key={reply.id} post={reply} onReply={onReply} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ThreadDetail: React.FC<ThreadDetailProps> = ({ thread, courseName, forumName }) => {
  const { courseId, forumId } = useParams<{ courseId: string; forumId: string }>();
  const { posts, isLoadingPosts } = useThreadPosts(thread.id);
  const [replyContent, setReplyContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const { user } = useAuth();
  const { mutate: createPost, isPending: isSubmitting } = useCreatePost(thread.id);
  const { subscription, isSubscribed, subscribe, unsubscribe } = useThreadSubscription(
    thread.id, null, user?.id || null
  );
  const { mutate: markAsRead } = useMarkThreadAsRead();
  
  useEffect(() => {
    if (thread && user) {
      markAsRead({ threadId: thread.id, userId: user.id });
    }
  }, [thread, user]);
  
  const handleCreatePost = () => {
    if (!user || !replyContent.trim()) return;
    
    createPost({
      content: replyContent,
      userId: user.id,
      parentId: replyTo
    });
    
    setReplyContent('');
    setReplyTo(null);
  };
  
  const handleReplyTo = (postId: string) => {
    setReplyTo(postId);
    // Scroll to reply box
    const replyBox = document.getElementById('reply-box');
    if (replyBox) {
      replyBox.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        const textarea = replyBox.querySelector('textarea');
        if (textarea) textarea.focus();
      }, 500);
    }
  };
  
  const handleCancelReply = () => {
    setReplyTo(null);
    setReplyContent('');
  };
  
  // Organize posts into a tree structure
  const organizePostsHierarchy = (postsArray: Post[] | undefined) => {
    if (!postsArray) return [];
    
    const postMap = new Map<string, Post>();
    const rootPosts: Post[] = [];
    
    // First pass: Create map of all posts
    postsArray.forEach(post => {
      postMap.set(post.id, { ...post, replies: [] });
    });
    
    // Second pass: Organize into hierarchy
    postsArray.forEach(post => {
      const currentPost = postMap.get(post.id);
      if (!currentPost) return;
      
      if (post.parent_id && postMap.has(post.parent_id)) {
        // This is a reply, add it to the parent's replies
        const parentPost = postMap.get(post.parent_id);
        parentPost!.replies = [...(parentPost!.replies || []), currentPost];
      } else {
        // This is a root post
        rootPosts.push(currentPost);
      }
    });
    
    return rootPosts.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  };
  
  const hierarchicalPosts = organizePostsHierarchy(posts);
  
  if (isLoadingPosts) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/courses">
              Courses
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to={`/courses/${courseId}`}>
              {courseName || 'Course Details'}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to={`/courses/${courseId}/forums`}>
              Forums
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to={`/courses/${courseId}/forums/${forumId}`}>
              {forumName || 'Forum'}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{thread.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      <div className="bg-card rounded-lg border shadow-sm p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{thread.title}</h1>
          
          {user && (
            <div className="flex items-center space-x-2">
              {isSubscribed ? (
                <Button variant="outline" size="sm" onClick={() => unsubscribe()}>
                  <BellOff className="h-4 w-4 mr-1" />
                  Unsubscribe
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => subscribe()}>
                  <Bell className="h-4 w-4 mr-1" />
                  Subscribe
                </Button>
              )}
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          {hierarchicalPosts.length > 0 ? (
            hierarchicalPosts.map((post, index) => (
              <PostItem 
                key={post.id} 
                post={post} 
                isFirstPost={index === 0}
                onReply={handleReplyTo}
              />
            ))
          ) : (
            <div className="text-center py-10 border rounded-lg bg-muted/20">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p>No posts in this thread yet.</p>
            </div>
          )}
        </div>
        
        {user && !thread.is_locked && (
          <div id="reply-box" className="mt-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {replyTo ? 'Reply to Post' : 'Reply to Thread'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write your reply here..."
                  className="min-h-[150px]"
                />
              </CardContent>
              <CardFooter className="flex justify-between">
                <div>
                  {replyTo && (
                    <Button variant="ghost" onClick={handleCancelReply}>
                      Cancel Reply
                    </Button>
                  )}
                </div>
                <Button 
                  onClick={handleCreatePost} 
                  disabled={!replyContent.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Posting...' : 'Post Reply'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreadDetail;
