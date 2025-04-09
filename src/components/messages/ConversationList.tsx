
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { User } from 'lucide-react';
import { Conversation } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
}

const ConversationList: React.FC<ConversationListProps> = ({ conversations, loading }) => {
  const { conversationId } = useParams();
  const { user } = useAuth();
  
  if (loading) {
    return (
      <div className="border rounded-md divide-y">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 flex justify-between items-center animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-muted rounded-full" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-40 bg-muted rounded" />
              </div>
            </div>
            <div className="h-3 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="border rounded-md p-6 text-center text-muted-foreground">
        No conversations yet. Start a new one!
      </div>
    );
  }

  const getConversationName = (conversation: Conversation) => {
    if (conversation.subject) return conversation.subject;
    
    if (conversation.participants) {
      // For 1-1 conversations, show the other person's name
      const otherParticipants = conversation.participants.filter(
        p => p.user_id !== user?.id
      );
      
      if (otherParticipants.length > 0) {
        const otherUser = otherParticipants[0].profile;
        if (otherUser) {
          return `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || 'User';
        }
      }
    }
    
    return 'Conversation';
  };
  
  const getLastMessagePreview = (conversation: Conversation) => {
    if (!conversation.last_message) return 'No messages yet';
    return conversation.last_message.content.length > 40 
      ? conversation.last_message.content.substring(0, 40) + '...' 
      : conversation.last_message.content;
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  const isUnread = (conversation: Conversation) => {
    return conversation.last_message && 
      !conversation.last_message.read && 
      conversation.last_message.sender_id !== user?.id;
  };

  return (
    <div className="border rounded-md divide-y">
      {conversations.map(conv => (
        <Link 
          key={conv.id} 
          to={`/messages/${conv.id}`}
          className={`p-4 flex justify-between items-center hover:bg-accent cursor-pointer ${
            conv.id === conversationId ? 'bg-accent/30' : ''
          } ${isUnread(conv) ? 'bg-accent/10 font-medium' : ''}`}
        >
          <div className="flex items-center space-x-3">
            <User className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="font-medium">{getConversationName(conv)}</div>
              <div className="text-sm text-muted-foreground truncate max-w-md">
                {getLastMessagePreview(conv)}
              </div>
            </div>
          </div>
          {conv.last_message && (
            <div className="text-sm text-muted-foreground">
              {formatDate(conv.last_message.created_at)}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
};

export default ConversationList;
