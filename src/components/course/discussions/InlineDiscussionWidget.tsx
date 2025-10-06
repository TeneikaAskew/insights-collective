/**
 * Inline Discussion Widget
 * Embeddable discussion component for content items (pages, videos, assignments)
 * Supports threaded discussions, upvotes, instructor endorsements
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  MessageSquare,
  ThumbsUp,
  Reply,
  Star,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  MoreVertical,
  Pin,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import contentDiscussionService, {
  ContentDiscussionWithUser,
  DiscussionType,
} from '@/services/contentDiscussionService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { createLogger } from '@/utils/logger';

const logger = createLogger('InlineDiscussionWidget');

interface InlineDiscussionWidgetProps {
  contentItemId: string;
  timestampSeconds?: number; // For video comments at specific times
  showHeader?: boolean;
  maxHeight?: string;
  allowAnonymous?: boolean;
}

export const InlineDiscussionWidget: React.FC<InlineDiscussionWidgetProps> = ({
  contentItemId,
  timestampSeconds,
  showHeader = true,
  maxHeight = '600px',
  allowAnonymous = false,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [discussions, setDiscussions] = useState<ContentDiscussionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<DiscussionType>('question');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [filter, setFilter] = useState<'all' | 'questions' | 'resolved' | 'endorsed'>('all');

  useEffect(() => {
    loadDiscussions();
  }, [contentItemId, timestampSeconds]);

  const loadDiscussions = async () => {
    try {
      setLoading(true);

      let data: ContentDiscussionWithUser[];

      if (timestampSeconds !== undefined) {
        // Load discussions for specific timestamp (video comments)
        data = await contentDiscussionService.getDiscussionsAtTimestamp(
          contentItemId,
          timestampSeconds
        );
      } else {
        // Load all discussions for content item
        data = await contentDiscussionService.getDiscussions(contentItemId);
      }

      setDiscussions(data);
    } catch (error) {
      logger.error('Error loading discussions', error);
      toast({
        title: 'Error',
        description: 'Failed to load discussions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    try {
      await contentDiscussionService.createDiscussion({
        contentItemId,
        userId: user.id,
        commentText: newComment,
        commentType,
        parentCommentId: replyingTo || undefined,
        timestampSeconds,
      });

      setNewComment('');
      setReplyingTo(null);
      await loadDiscussions();

      toast({
        title: 'Comment posted',
        description: 'Your comment has been added successfully',
      });
    } catch (error) {
      logger.error('Error posting comment', error);
      toast({
        title: 'Error',
        description: 'Failed to post comment',
        variant: 'destructive',
      });
    }
  };

  const handleUpvote = async (discussionId: string) => {
    if (!user) return;

    try {
      const upvoted = await contentDiscussionService.upvoteDiscussion(discussionId, user.id);

      // Update local state
      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === discussionId
            ? { ...d, upvote_count: d.upvote_count + (upvoted ? 1 : -1) }
            : d
        )
      );
    } catch (error) {
      logger.error('Error upvoting discussion', error);
    }
  };

  const handleEndorse = async (discussionId: string) => {
    if (!user) return;

    try {
      const updated = await contentDiscussionService.toggleEndorsement(discussionId, user.id);

      // Update local state
      setDiscussions((prev) =>
        prev.map((d) => (d.id === discussionId ? { ...d, ...updated } : d))
      );

      toast({
        title: updated.instructor_endorsed ? 'Comment endorsed' : 'Endorsement removed',
        description: updated.instructor_endorsed
          ? 'This comment has been marked as helpful'
          : 'Endorsement has been removed',
      });
    } catch (error) {
      logger.error('Error endorsing discussion', error);
    }
  };

  const handleResolve = async (discussionId: string) => {
    try {
      await contentDiscussionService.updateDiscussion(discussionId, { isResolved: true });
      await loadDiscussions();

      toast({
        title: 'Discussion resolved',
        description: 'This discussion has been marked as resolved',
      });
    } catch (error) {
      logger.error('Error resolving discussion', error);
    }
  };

  const handleDelete = async (discussionId: string) => {
    try {
      await contentDiscussionService.deleteDiscussion(discussionId);
      await loadDiscussions();

      toast({
        title: 'Comment deleted',
        description: 'The comment has been removed',
      });
    } catch (error) {
      logger.error('Error deleting discussion', error);
    }
  };

  const handleEdit = async (discussionId: string) => {
    if (!editText.trim()) return;

    try {
      await contentDiscussionService.updateDiscussion(discussionId, {
        commentText: editText,
      });

      setEditingId(null);
      setEditText('');
      await loadDiscussions();

      toast({
        title: 'Comment updated',
        description: 'Your comment has been updated',
      });
    } catch (error) {
      logger.error('Error updating discussion', error);
    }
  };

  const getFilteredDiscussions = () => {
    let filtered = discussions;

    switch (filter) {
      case 'questions':
        filtered = discussions.filter((d) => d.comment_type === 'question');
        break;
      case 'resolved':
        filtered = discussions.filter((d) => d.is_resolved);
        break;
      case 'endorsed':
        filtered = discussions.filter((d) => d.instructor_endorsed);
        break;
    }

    return filtered;
  };

  const getThreadedDiscussions = () => {
    const filtered = getFilteredDiscussions();
    const threads = filtered.filter((d) => !d.parent_comment_id);
    const replies = filtered.filter((d) => d.parent_comment_id);

    return threads.map((thread) => ({
      ...thread,
      replies: replies.filter((r) => r.parent_comment_id === thread.id),
    }));
  };

  const isInstructor = user?.roles?.includes('instructor') || user?.roles?.includes('admin');

  const renderDiscussion = (
    discussion: ContentDiscussionWithUser & { replies?: ContentDiscussionWithUser[] },
    isReply = false
  ) => {
    const isEditing = editingId === discussion.id;
    const canEdit = user?.id === discussion.user_id;
    const canModerate = isInstructor;

    return (
      <div key={discussion.id} className={`${isReply ? 'ml-8 mt-2' : 'mt-4'}`}>
        <div className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={discussion.user_avatar} />
            <AvatarFallback>
              {discussion.user_name?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{discussion.user_name}</span>
              {discussion.is_instructor && (
                <Badge variant="secondary" className="text-xs">
                  Instructor
                </Badge>
              )}
              {discussion.instructor_endorsed && (
                <Badge variant="default" className="text-xs gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Endorsed
                </Badge>
              )}
              {discussion.is_resolved && (
                <Badge variant="outline" className="text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Resolved
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {discussion.comment_type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })}
              </span>
              {discussion.is_edited && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
            </div>

            {/* Content */}
            {isEditing ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[80px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleEdit(discussion.id)}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setEditText('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm mt-1 whitespace-pre-wrap">{discussion.comment_text}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUpvote(discussion.id)}
                className="h-7 gap-1"
              >
                <ThumbsUp className="h-3 w-3" />
                {discussion.upvote_count > 0 && (
                  <span className="text-xs">{discussion.upvote_count}</span>
                )}
              </Button>

              {!isReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyingTo(discussion.id)}
                  className="h-7 gap-1"
                >
                  <Reply className="h-3 w-3" />
                  Reply
                </Button>
              )}

              {canModerate && !discussion.is_resolved && discussion.comment_type === 'question' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResolve(discussion.id)}
                  className="h-7 gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Resolve
                </Button>
              )}

              {canModerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEndorse(discussion.id)}
                  className="h-7 gap-1"
                >
                  <Star
                    className={`h-3 w-3 ${discussion.instructor_endorsed ? 'fill-current' : ''}`}
                  />
                  {discussion.instructor_endorsed ? 'Endorsed' : 'Endorse'}
                </Button>
              )}

              {(canEdit || canModerate) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEdit && (
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingId(discussion.id);
                          setEditText(discussion.comment_text);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {(canEdit || canModerate) && (
                      <DropdownMenuItem
                        onClick={() => handleDelete(discussion.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Reply Form */}
            {replyingTo === discussion.id && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write your reply..."
                  className="min-h-[80px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSubmitComment}>
                    Post Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplyingTo(null);
                      setNewComment('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Replies */}
            {discussion.replies && discussion.replies.length > 0 && (
              <div className="mt-2 space-y-2">
                {discussion.replies.map((reply) => renderDiscussion(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const threaded = getThreadedDiscussions();

  return (
    <Card className="w-full">
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Discussion ({discussions.length})
              </CardTitle>
              <CardDescription>
                Ask questions, share insights, or discuss this content
              </CardDescription>
            </div>

            <Select value={filter} onValueChange={(val: any) => setFilter(val)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Comments</SelectItem>
                <SelectItem value="questions">Questions</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="endorsed">Endorsed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      )}

      <CardContent>
        {/* New Comment Form */}
        {user && !replyingTo && (
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback>{user.full_name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your thoughts or ask a question..."
                  className="min-h-[100px]"
                />

                <div className="flex items-center gap-2">
                  <Select value={commentType} onValueChange={(val: DiscussionType) => setCommentType(val)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="comment">Comment</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="suggestion">Suggestion</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button onClick={handleSubmitComment} disabled={!newComment.trim()}>
                    Post
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Separator className="my-4" />

        {/* Discussions List */}
        <div className="space-y-4" style={{ maxHeight, overflowY: 'auto' }}>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading discussions...</p>
          ) : threaded.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                No discussions yet. Be the first to start a conversation!
              </p>
            </div>
          ) : (
            threaded.map((discussion) => renderDiscussion(discussion))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InlineDiscussionWidget;
