
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  conversations: any[];
  loading: boolean;
}

const ConversationList: React.FC<ConversationListProps> = ({ conversations, loading }) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();

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

  if (conversations.length === 0) {
    return (
      <div className="text-center p-6 border rounded-md">
        <p className="text-muted-foreground mb-2">No conversations yet</p>
        <p className="text-sm text-muted-foreground">Start a new conversation to connect with instructors and classmates.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 h-full overflow-auto">
      {conversations.map((conversation) => {
        // Safely handle missing participants
        const participants = conversation.participants || [];
        const otherParticipants = participants.filter(
          (p: any) => p.user_id !== conversation.created_by
        );
        
        // Format the timestamp
        let timeAgo = '';
        try {
          if (conversation.last_message_time) {
            timeAgo = formatDistanceToNow(new Date(conversation.last_message_time), { addSuffix: true });
          } else if (conversation.updated_at) {
            timeAgo = formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true });
          }
        } catch (error) {
          console.error('Error formatting date:', error);
          timeAgo = 'Recently';
        }

        return (
          <Link
            key={conversation.id}
            to={`/messages/${conversation.id}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/messages/${conversation.id}`);
            }}
          >
            <Card
              className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                conversationId === conversation.id ? 'bg-muted' : ''
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex gap-3">
                  {conversation.is_group ? (
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>GP</AvatarFallback>
                      </Avatar>
                      {otherParticipants.length > 0 && (
                        <Avatar className="h-6 w-6 absolute -bottom-1 -right-1 border-2 border-background">
                          <AvatarFallback>{otherParticipants[0]?.profile?.first_name?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ) : (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={otherParticipants[0]?.profile?.avatar_url} />
                      <AvatarFallback>
                        {otherParticipants[0]?.profile?.first_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="space-y-1">
                    <p className="font-medium line-clamp-1">
                      {conversation.subject || 
                        (conversation.is_group 
                          ? `Group (${participants.length} participants)` 
                          : otherParticipants[0]?.profile?.first_name
                            ? `${otherParticipants[0]?.profile?.first_name} ${otherParticipants[0]?.profile?.last_name || ''}`
                            : 'Conversation'
                        )
                      }
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {conversation.last_message || 'Start a conversation'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">{timeAgo}</span>
                  {conversation.unread_count > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 mt-1">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
};

export default ConversationList;
