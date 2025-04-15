import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Archive, Trash, Dot, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';

interface ConversationListProps {
  conversations: any[];
  loading: boolean;
  error?: any;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({ 
  conversations = [], 
  loading, 
  error, 
  onDelete, 
  onArchive 
}) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<'archive' | 'delete' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { user } = useAuth();

  const handleClick = (id: string) => {
    navigate(`/messages/${id}`);
  };

  const handleConfirm = () => {
    if (!selectedId) return;
    if (confirmAction === 'archive') onArchive?.(selectedId);
    if (confirmAction === 'delete') onDelete?.(selectedId);
    setConfirmAction(null);
    setSelectedId(null);
  };

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading conversations</AlertTitle>
        <AlertDescription>
          {error.message || 'Please try again later.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.filter(c => !c.deleted_at && !c.archived).map((conv) => {
        const isActive = conversationId === conv.id;
        const lastMessage = conv.last_message;
        const unreadCount = conv.messages?.filter((msg: any) => 
          !msg.read && msg.sender_id !== (conv.current_user_id || user?.id)
        ).length || 0;
        
        let displayName = 'Unknown';
        let avatarFallback = 'U';
        let avatarUrl;
        
        if (conv.is_group) {
          const participantCount = conv.participants?.length || 0;
          displayName = `Group (${participantCount} participants)`;
          avatarFallback = 'G';
          // Use the first two participants' avatars for group display
          const otherParticipants = conv.participants
            .filter((p: any) => p.user_id !== (conv.current_user_id || user?.id))
            .slice(0, 2);
          if (otherParticipants.length > 0) {
            avatarUrl = otherParticipants[0]?.profile?.avatar_url;
          }
        } else {
          const participant = conv.participants.find((p: any) => 
            p.user_id !== (conv.current_user_id || user?.id)
          );
          if (participant?.profile) {
            displayName = `${participant.profile.first_name || 'User'} ${participant.profile.last_name || ''}`;
            avatarFallback = participant.profile.first_name?.[0] || 'U';
            avatarUrl = participant.profile.avatar_url;
          }
        }

        return (
          <Card
            key={conv.id}
            className={`p-3 cursor-pointer transition hover:bg-muted/50 relative ${isActive ? 'bg-muted' : ''}`}
            onClick={() => handleClick(conv.id)}
          >
            <div className="flex justify-between items-center">
              <div className="flex gap-3 items-start">
                {conv.is_group ? (
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="bg-primary/10">
                        <Users className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                ) : (
                  <Avatar>
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium line-clamp-1">
                      {displayName}
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-xs text-blue-600">• {unreadCount} unread</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {lastMessage?.content || 'No messages yet'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onArchive?.(conv.id); }}>
                  <Archive className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete?.(conv.id); }}>
                  <Trash className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
            </p>
          </Card>
        );
      })}
    </div>
  );
};

export default ConversationList;
