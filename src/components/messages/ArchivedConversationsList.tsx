
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArchiveRestore } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface ArchivedConversationsListProps {
  conversations: any[];
  loading: boolean;
  error?: any;
  onRestore?: (id: string) => void;
}

const ArchivedConversationsList: React.FC<ArchivedConversationsListProps> = ({
  conversations = [],
  loading,
  error,
  onRestore
}) => {
  const navigate = useNavigate();
  
  const handleClick = (id: string) => {
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

  // Filter only archived conversations that aren't deleted
  const archivedConversations = conversations.filter(c => c.archived === true && !c.deleted_at);
  
  if (archivedConversations.length === 0) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        No archived conversations
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {archivedConversations.map((conv) => {
        const lastMessage = conv.last_message;
        const participantCount = conv.participants?.length || 0;
        const participant = conv.participants?.find((p: any) => p.user_id !== conv.current_user_id);
        
        // Set proper display name
        let displayName = 'Unknown';
        let avatarFallback = 'U';

        if (conv.is_group) {
          displayName = `Group (${participantCount} participants)`;
          avatarFallback = 'G';
        } else if (participant?.profile) {
          // Only show "Unknown" if both first_name and last_name are empty/null
          const firstName = participant.profile.first_name || '';
          const lastName = participant.profile.last_name || '';
          
          if (firstName || lastName) {
            displayName = `${firstName} ${lastName}`.trim();
            avatarFallback = firstName?.[0] || lastName?.[0] || 'U';
          }
        }

        return (
          <Card
            key={conv.id}
            className="p-3 cursor-pointer transition hover:bg-muted/50 relative"
            onClick={() => handleClick(conv.id)}
          >
            <div className="flex justify-between items-center">
              <div className="flex gap-3 items-start">
                <Avatar>
                  <AvatarImage src={participant?.profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium line-clamp-1">
                      {displayName}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {lastMessage?.content || 'No messages yet'}
                  </p>
                </div>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onRestore?.(conv.id); 
                }}
                aria-label="Restore conversation"
              >
                <ArchiveRestore className="h-4 w-4" />
              </Button>
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

export default ArchivedConversationsList;
