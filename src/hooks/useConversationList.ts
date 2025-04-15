import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Archive, Trash } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

const ConversationList = ({
  conversations = [],
  loading,
  error,
  onArchive,
  onDelete
}) => {
  const navigate = useNavigate();
  
  const handleClick = (id) => {
    navigate(`/messages/${id}`);
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

  // Filter out conversations that are archived or deleted
  const activeConversations = conversations.filter(c => !c.archived && !c.deleted_at);
  
  if (activeConversations.length === 0) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        No conversations found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activeConversations.map((conv) => {
        const lastMessage = conv.last_message;
        const participantCount = conv.participants?.length || 0;
        
        // Find other participant(s) - exclude current user
        const otherParticipants = conv.participants?.filter(
          (p) => p.user_id !== conv.created_by
        ) || [];
        
        // Set proper display name
        let displayName = conv.subject || '';
        let avatarUrl = '';
        let avatarFallback = '';

        if (conv.is_group) {
          displayName = displayName || `Group (${participantCount} participants)`;
          avatarFallback = 'G';
        } else if (otherParticipants.length > 0) {
          const participant = otherParticipants[0];
          if (participant?.profile) {
            const firstName = participant.profile.first_name || '';
            const lastName = participant.profile.last_name || '';
            
            // Use subject if available, otherwise use participant name
            displayName = displayName || `${firstName} ${lastName}`.trim();
            
            // If we still don't have a name, only then use "Unknown"
            displayName = displayName || 'Unknown';
            
            avatarUrl = participant.profile.avatar_url || '';
            avatarFallback = firstName.charAt(0) || lastName.charAt(0) || 'U';
          }
        }

        // Calculate if this conversation has unread messages
        const hasUnread = conv.last_message && !conv.last_message.read && 
                        conv.last_message.sender_id !== conv.created_by;

        return (
          <Card
            key={conv.id}
            className={`p-3 cursor-pointer transition relative ${
              hasUnread ? 'bg-amber-50' : 'hover:bg-muted/50'
            }`}
            onClick={() => handleClick(conv.id)}
          >
            <div className="flex justify-between items-center">
              <div className="flex gap-3 items-start">
                <Avatar>
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback>
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium line-clamp-1 ${hasUnread ? 'font-bold' : ''}`}>
                      {displayName}
                    </span>
                    {hasUnread && (
                      <span className="w-2 h-2 bg-amber-500 rounded-full" />
                    )}
                  </div>
                  <p className={`text-sm line-clamp-1 ${
                    hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}>
                    {lastMessage?.content || 'No messages yet'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onArchive?.(conv.id); 
                    }}
                    aria-label="Archive conversation"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onDelete?.(conv.id); 
                    }}
                    aria-label="Delete conversation"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lastMessage?.created_at ? 
                    formatDistanceToNow(new Date(lastMessage.created_at), { addSuffix: true }) :
                    formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default ConversationList;