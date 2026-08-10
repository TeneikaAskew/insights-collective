import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  Reply, 
  Edit, 
  Trash2, 
  Send, 
  Eye, 
  EyeOff,
  Clock,
  MoreVertical,
  FileText,
  Star,
  MessageCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useSubmissionComments } from '@/hooks/useGradeHistory';
import { SubmissionComment } from '@/services/gradeHistoryService';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useConfirm } from '@/components/dialogs/DialogsProvider';
import { formatProfileName } from '@/lib/utils';

interface SubmissionCommentsProps {
  submissionId: string;
  submissionType: 'assignment' | 'quiz';
  allowComments?: boolean;
  showPrivateComments?: boolean;
  /** Seeds the composer, e.g. when commenting on a specific uploaded file. */
  commentSeed?: { text: string; nonce: number };
}

const commentTypes = [
  { value: 'feedback', label: 'General Feedback', icon: MessageSquare },
  { value: 'grade_justification', label: 'Grade Justification', icon: Star },
  { value: 'question', label: 'Question', icon: MessageCircle },
  { value: 'note', label: 'Note', icon: FileText },
  { value: 'rubric_feedback', label: 'Rubric Feedback', icon: FileText },
];

export const SubmissionComments: React.FC<SubmissionCommentsProps> = ({
  submissionId,
  submissionType,
  allowComments = true,
  showPrivateComments = false,
  commentSeed,
}) => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const {
    comments,
    isLoading,
    createComment,
    updateComment,
    deleteComment,
    isCreating,
  } = useSubmissionComments(submissionId, submissionType);

  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<string>('feedback');
  const [isPrivate, setIsPrivate] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const composerRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!commentSeed?.text) return;
    setNewComment((prev) => (prev.trim() ? `${prev.trim()}\n\n${commentSeed.text}` : commentSeed.text));
    composerRef.current?.focus();
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [commentSeed?.nonce]);

  const handleSubmitComment = () => {
    if (!newComment.trim() || !user) return;


    const authorType = user.role === 'instructor' || user.role === 'admin' ? 'instructor' : 'student';

    createComment({
      submission_id: submissionId,
      submission_type: submissionType,
      comment_text: newComment,
      comment_type: commentType as any,
      author_id: user.id,
      author_type: authorType,
      is_private: isPrivate,
      parent_comment_id: replyingTo || undefined,
      thread_position: 0,
      is_draft: false,
      is_edited: false,
    });

    setNewComment('');
    setReplyingTo(null);
    setIsPrivate(false);
  };

  const handleEditComment = (comment: SubmissionComment) => {
    setEditingComment(comment.id);
    setEditText(comment.comment_text);
  };

  const handleUpdateComment = (commentId: string) => {
    if (!editText.trim()) return;

    updateComment({
      id: commentId,
      updates: { comment_text: editText },
    });

    setEditingComment(null);
    setEditText('');
  };

  const handleDeleteComment = async (commentId: string) => {
    if (await confirm({ title: 'Delete comment?', description: 'This permanently removes the comment.', destructive: true, confirmLabel: 'Delete' })) {
      deleteComment(commentId);
    }
  };

  const getCommentTypeIcon = (type: string) => {
    const commentType = commentTypes.find(ct => ct.value === type);
    return commentType ? commentType.icon : MessageSquare;
  };

  const getCommentTypeLabel = (type: string) => {
    const commentType = commentTypes.find(ct => ct.value === type);
    return commentType ? commentType.label : 'Comment';
  };

  const canEditComment = (comment: SubmissionComment) => {
    return user?.id === comment.author_id;
  };

  const canDeleteComment = (comment: SubmissionComment) => {
    return user?.id === comment.author_id || user?.role === 'instructor' || user?.role === 'admin';
  };

  const filteredComments = comments?.filter(comment => {
    if (comment.is_private && !showPrivateComments && comment.author_id !== user?.id) {
      return false;
    }
    return true;
  }) || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments & Feedback
          {filteredComments.length > 0 && (
            <Badge variant="secondary">{filteredComments.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {filteredComments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No comments yet. Be the first to add feedback!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredComments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src={comment.author?.avatar_url} />
                    <AvatarFallback>
                      {formatProfileName(comment.author).charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {formatProfileName(comment.author)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {comment.author_type}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getCommentTypeLabel(comment.comment_type)}
                        </Badge>
                        {comment.is_private && (
                          <Badge variant="outline" className="text-xs">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Private
                          </Badge>
                        )}
                        {comment.is_edited && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Edited
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setReplyingTo(comment.id)}>
                              <Reply className="h-4 w-4 mr-2" />
                              Reply
                            </DropdownMenuItem>
                            {canEditComment(comment) && (
                              <DropdownMenuItem onClick={() => handleEditComment(comment)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {canDeleteComment(comment) && (
                              <DropdownMenuItem 
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-ss-bad"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {editingComment === comment.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-[100px]"
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleUpdateComment(comment.id)}
                            disabled={!editText.trim()}
                          >
                            Save
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => {
                              setEditingComment(null);
                              setEditText('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm whitespace-pre-wrap">{comment.comment_text}</p>
                      </div>
                    )}

                    {comment.replies && comment.replies.length > 0 && (
                      <div className="ml-4 space-y-2 border-l-2 border-border pl-4">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="flex items-start gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={reply.author?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {formatProfileName(reply.author).charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">
                                  {formatProfileName(reply.author)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <div className="bg-card rounded p-2 border">
                                <p className="text-xs">{reply.comment_text}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {replyingTo === comment.id && (
                  <div className="ml-11 space-y-2 border-l-2 border-primary pl-4">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a reply..."
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim() || isCreating}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Reply
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
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
              </div>
            ))}
          </div>
        )}

        {allowComments && !replyingTo && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Select value={commentType} onValueChange={setCommentType}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(user?.role === 'instructor' || user?.role === 'admin') && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="private-comment"
                      checked={isPrivate}
                      onCheckedChange={setIsPrivate}
                    />
                    <Label htmlFor="private-comment" className="text-sm">
                      Private (instructors only)
                    </Label>
                  </div>
                )}
              </div>

              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment or feedback..."
                className="min-h-[100px]"
              />

              <div className="flex justify-end">
                <Button 
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || isCreating}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Add Comment
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};