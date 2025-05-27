import React from 'react';
import { useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation } from '@/types/supabase';

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  error?: any;
  onConversationClick?: (conversation: Conversation) => void;
  actions?: (conversation: Conversation) => React.ReactNode;
}

const ConversationList: React.FC<ConversationListProps> = ({ 
  conversations = [], 
  loading, 
  error,
  onConversationClick,
  actions
}) => {
  const { conversationId } = useParams();
  const { user } = useAuth();

  // Helper function to get initials
  const getInitials = (profile: any): string => {
    if (!profile) return 'U';
    
    const firstName = profile.first_name || '';
    const lastName = profile.last_name || '';
    
    if (!firstName && !lastName) return 'U';
    return (firstName.charAt(0) + (lastName ? lastName.charAt(0) : '')).toUpperCase();
  };

  // Helper function to get display name for conversation
  const getConversationDisplayName = (conversation: Conversation): string => {
    if (conversation.subject && conversation.subject !== 'null null') {
      return conversation.subject;
    }

    // Find the other participant (not the current user)
    const otherParticipant = conversation.participants?.find(
      p => p.user_id !== user?.id
    );

    if (otherParticipant?.profile) {
      const { first_name, last_name } = otherParticipant.profile;
      if (first_name || last_name) {
        return `${first_name || ''} ${last_name || ''}`.trim();
      }
    }

    return 'Unknown User';
  };

  // Helper function to get the other participant's avatar
  const getOtherParticipantAvatar = (conversation: Conversation) => {
    const otherParticipant = conversation.participants?.find(
      p => p.user_id !== user?.id
    );
    return otherParticipant?.profile;
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
            <div className="flex items-center space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No conversations found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conversation) => {
        const otherParticipant = getOtherParticipantAvatar(conversation);
        const displayName = getConversationDisplayName(conversation);
        const isActive = conversationId === conversation.id;
        
        return (
          <Card 
            key={conversation.id} 
            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
              isActive ? 'ring-2 ring-blue-500 bg-blue-50' : ''
            }`}
            onClick={() => onConversationClick?.(conversation)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={otherParticipant?.avatar_url || ''} />
                  <AvatarFallback>{getInitials(otherParticipant)}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-gray-900 truncate">
                    {displayName}
                  </h3>
                  
                  {conversation.last_message && (
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {conversation.last_message.content}
                    </p>
                  )}
                  
                  {!conversation.last_message && (
                    <p className="text-sm text-gray-400 italic">No messages yet</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {conversation.last_message && (
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(conversation.last_message.created_at), { 
                      addSuffix: true 
                    })}
                  </span>
                )}
                
                {actions && actions(conversation)}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default ConversationList;