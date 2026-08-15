
import React, { useEffect, useRef } from 'react';
import { Message as MessageType } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';

interface MessageThreadProps {
  messages: MessageType[];
  loading: boolean;
}

const MessageThread: React.FC<MessageThreadProps> = ({ messages, loading }) => {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    // Scroll the thread's own container, never the page. scrollIntoView walks every
    // scrollable ancestor, so each send (and the initial load) also dragged the
    // document itself down to wherever the composer happened to sit.
    const el = containerRef.current;
    if (!el || messages.length === 0) return;
    el.scrollTo({ top: el.scrollHeight, behavior: hasScrolledRef.current ? 'smooth' : 'auto' });
    hasScrolledRef.current = true;
  }, [messages]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`flex items-start gap-2 ${i % 2 === 0 ? 'justify-end' : ''}`}>
            {i % 2 !== 0 && <div className="h-8 w-8 bg-muted rounded-full" />}
            <div className={`animate-pulse p-3 rounded-md max-w-[70%] ${i % 2 === 0 ? 'bg-ss-warn-chip' : 'bg-muted'}`}>
              <div className="h-4 w-32 bg-ss-track rounded mb-2" />
              <div className="h-3 w-40 bg-ss-track rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-center text-muted-foreground">
          No messages yet. Start the conversation!
        </p>
      </div>
    );
  }

  const getInitials = (message: MessageType) => {
    const sender = message.sender;
    if (!sender || !sender.first_name) return 'U';
    return (sender.first_name.charAt(0) + (sender.last_name?.charAt(0) || '')).toUpperCase();
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy h:mm a');
  };

  const groupedMessages: { date: string; messages: MessageType[] }[] = [];
  
  messages.forEach(message => {
    const messageDate = new Date(message.created_at).toDateString();
    const existingGroup = groupedMessages.find(group => group.date === messageDate);
    
    if (existingGroup) {
      existingGroup.messages.push(message);
    } else {
      groupedMessages.push({
        date: messageDate,
        messages: [message]
      });
    }
  });

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-y-auto p-4">
      {groupedMessages.map((group, groupIndex) => (
        <div key={group.date} className="mb-4">
          <div className="flex justify-center mb-4">
            <div className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
              {format(new Date(group.date), 'MMMM d, yyyy')}
            </div>
          </div>
          
          {group.messages.map((message, index) => {
            const isCurrentUser = message.sender_id === user?.id;
            
            return (
              <div 
                key={message.id} 
                className={`flex items-start mb-4 ${isCurrentUser ? 'justify-end' : ''}`}
              >
                {!isCurrentUser && (
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarImage src={message.sender?.avatar_url || ''} />
                    <AvatarFallback className="bg-muted text-foreground">{getInitials(message)}</AvatarFallback>
                  </Avatar>
                )}
                
                <div className={`max-w-[70%] ${isCurrentUser ? 'order-1' : 'order-2'}`}>
                  <div 
                    className={`p-3 rounded-lg ${
                      isCurrentUser
                        ? 'bg-ss-peach-deep text-white rounded-br-none'
                        : 'bg-muted text-foreground rounded-bl-none'
                    }`}
                  >
                    {message.content}
                  </div>
                  <p className={`text-xs text-muted-foreground mt-1 ${isCurrentUser ? 'text-right' : ''}`}>
                    {formatMessageDate(message.created_at)}
                  </p>
                </div>
                
                {isCurrentUser && (
                  <Avatar className="h-8 w-8 ml-2">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-ss-warn-chip text-ss-warn">{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default MessageThread;
