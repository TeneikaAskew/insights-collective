
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ConversationListProps {
  conversations: any[];
  loading: boolean;
  error?: any;
}

const ConversationList: React.FC<ConversationListProps> = ({ conversations = [], loading, error }) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  // Helper function to get avatar URL from various possible locations
  const getAvatarUrl = (participant: any) => {
    // Check all possible paths for avatar URLs
    return participant?.profile?.avatar_url || 
           // participant?.avatar_url || 
           // participant?.user_metadata?.avatar_url || 
           '';
  };

  // Helper function to get initials consistently
  const getInitials = (participant: any) => {
    if (!participant?.profile?.first_name) return 'U';
    return (
      participant.profile.first_name.charAt(0) + 
      (participant.profile.last_name?.charAt(0) || '')
    ).toUpperCase();
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

  if (!conversations || conversations.length === 0) {
    return (
      <div className="text-center p-6 border rounded-md bg-amber-50 border-amber-200">
        <p className="text-amber-800 mb-2 font-medium">No conversations yet</p>
        <p className="text-sm text-amber-700">Start a new conversation to connect with instructors and classmates.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 h-full overflow-auto">
      {conversations.map((conversation) => {
        if (!conversation) return null;
        
        // Safely handle missing participants
        const participants = conversation.participants || [];
        const otherParticipants = participants.filter(
          (p: any) => p && p.user_id !== conversation.created_by
        );
        
        // Format the timestamp
        let timeAgo = '';
        try {
          if (conversation.last_message?.created_at) {
            timeAgo = formatDistanceToNow(new Date(conversation.last_message.created_at), { addSuffix: true });
          } else if (conversation.updated_at) {
            timeAgo = formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true });
          }
        } catch (error) {
          console.error('Error formatting date:', error);
          timeAgo = 'Recently';
        }

        // Calculate if there are any unread messages
        const unreadCount = conversation.last_message && 
                           !conversation.last_message.read && 
                           conversation.last_message.sender_id !== conversation.created_by ? 1 : 0;

        // Only log after otherParticipants is defined
        if (otherParticipants && otherParticipants.length > 0) {
          console.log(otherParticipants[0]);
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
              className={`p-4 hover:bg-amber-50/50 cursor-pointer transition-colors ${
                conversationId === conversation.id ? 'bg-amber-50 border-amber-200' : ''
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex gap-3">
                  {conversation.is_group ? (
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-amber-100 text-amber-800">GP</AvatarFallback>
                      </Avatar>
                      {otherParticipants.length > 0 && otherParticipants[0]?.profile && (
                        <Avatar className="h-6 w-6 absolute -bottom-1 -right-1 border-2 border-background">
                          <AvatarImage src={getAvatarUrl(otherParticipants[0])} />
                          <AvatarFallback className="bg-amber-200 text-amber-800">
                            {getInitials(otherParticipants[0])}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ) : (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={getAvatarUrl(otherParticipants[0])} />
                      <AvatarFallback className="bg-amber-100 text-amber-800">
                        {getInitials(otherParticipants[0])}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="space-y-1">
                    <p className="font-medium line-clamp-1 text-gray-800">
                      {conversation.subject || 
                        (conversation.is_group 
                          ? `Group (${participants.length} participants)` 
                          : otherParticipants[0]?.profile?.first_name
                            ? `${otherParticipants[0]?.profile?.first_name} ${otherParticipants[0]?.profile?.last_name || ''}`
                            : 'Conversation'
                        )
                      }
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-1">
                      {conversation.last_message?.content || 'Start a conversation'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-500">{timeAgo}</span>
                  {unreadCount > 0 && (
                    <span className="bg-amber-500 text-white text-xs rounded-full px-2 py-0.5 mt-1">
                      {unreadCount}
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
