
import React, { useRef, useEffect } from 'react';
import { Message } from './types';
import MessageDisplay from './MessageDisplay';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  return (
    <div className="flex-1 p-4 space-y-4 overflow-hidden">
      {messages.map((message) => (
        <MessageDisplay key={message.id} message={message} />
      ))}
      
      {isLoading && (
        <div className="flex justify-start">
          <div className="max-w-3xl p-3 rounded-lg bg-slate-100 text-slate-800">
            <div className="flex space-x-2">
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-75"></div>
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse delay-150"></div>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
