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

  // Helper function to get initials
  const getInitials = (profile: any): string => {
    if (!profile) return 'U';
    
    const firstName = profile.first_name || '';
    const lastName = profile.last_name || '';
    
    if (!firstName && !lastName) return 'U';
    return (firstName.charAt(0) + (lastName ? lastName.charAt(0) : '')).toUpperCase();
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

  // Improved deduplication logic
  const uniqueConversations = conversations.reduce((acc: any[], current) => {
    // Skip invalid conversations
    if (!current) return acc;
    
    // For group conversations, always include them
    if (current.is_group) {
      acc.push(current);
      return acc;
    }

    console.log("Conversation Participants: ", current.participants)
    
    // For one-on-one conversations, identify by participant
    const otherParticipants = (current.participants || []).filter(
      (p: any) => p && p.user_id !== current.created_by
    );

    console.log("Other Participants original: ", otherParticipants)
    
    // If no other participants, add it
    if (!otherParticipants.length) {
      acc.push(current);
      return acc;
    }
    
    // For each other participant, check if we have a conversation already
    const otherParticipantIds = otherParticipants.map((p: any) => p.user_id).sort().join(',');
    
    // Find if this participant combination already exists in our accumulator
    const existingConvIndex = acc.findIndex((conv) => {
      if (conv.is_group) return false;
      
      const convOtherParticipants = (conv.participants || []).filter(
        (p: any) => p && p.user_id !== conv.created_by
      );
      
      const convParticipantIds = convOtherParticipants
        .map((p: any) => p.user_id)
        .sort()
        .join(',');
      
      return convParticipantIds === otherParticipantIds;
    });
    
    // If we already have a conversation with this participant, keep the most recent one
    if (existingConvIndex !== -1) {
      const existingConv = acc[existingConvIndex];
      const existingDate = new Date(existingConv.updated_at || existingConv.created_at);
      const currentDate = new Date(current.updated_at || current.created_at);
      
      if (currentDate > existingDate) {
        // Replace with the more recent conversation
        acc[existingConvIndex] = current;
      }
    } else {
      // Add this new conversation
      acc.push(current);
    }
    
    return acc;
  }, []);
  
  // Sort by most recent first
  const sortedConversations = [...uniqueConversations].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at);
    const dateB = new Date(b.updated_at || b.created_at);
    return dateB.getTime() - dateA.getTime();
  });

  console.log("ConversationList - sortedConversations:", sortedConversations);

  return (
    <div className="space-y-2 h-full overflow-auto">
      {sortedConversations.map((conversation) => {
        if (!conversation) return null;
        
        // Safely handle participants
        const participants = conversation.participants || [];
        const otherParticipants = participants.filter(
          (p: any) => p.user_id !== conversation.created_by
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

        // Get the first other participant's profile
        const otherProfile = otherParticipants.length > 0 ? otherParticipants[0].profile : null;
        
        // Log the actual profile data to debug avatar issues
        console.log(`Conversation ${conversation.id} - otherProfile:`, otherProfile);
        console.log(`Conversation ${conversation.id} - avatar URL:`, otherProfile?.avatar_url);

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
                        <AvatarImage src="https://api.dicebear.com/6.x/avataaars/svg?seed=Group" />
                        <AvatarFallback className="bg-amber-100 text-amber-800">GP</AvatarFallback>
                      </Avatar>
                      {otherProfile && (
                        <Avatar className="h-6 w-6 absolute -bottom-1 -right-1 border-2 border-background">
                          <AvatarImage src={otherProfile.avatar_url} />
                          <AvatarFallback className="bg-amber-200 text-amber-800">
                            {getInitials(otherProfile)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ) : (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={otherProfile?.avatar_url} />
                      <AvatarFallback className="bg-amber-100 text-amber-800">
                        {getInitials(otherProfile)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="space-y-1">
                    <p className="font-medium line-clamp-1 text-gray-800">
                      {conversation.subject || 
                        (conversation.is_group 
                          ? `Group (${participants.length} participants)` 
                          : otherProfile?.first_name
                            ? `${otherProfile.first_name} ${otherProfile.last_name || ''}`
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