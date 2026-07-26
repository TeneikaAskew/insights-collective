
import React from 'react';
import { Settings } from 'lucide-react';
import { Message } from './types';
import { formatMessage } from './utils/messageFormatting';
import { sanitizeHTML } from '@/utils/sanitize';

interface MessageDisplayProps {
  message: Message;
}

const MessageDisplay: React.FC<MessageDisplayProps> = ({ message }) => {
  return (
    <div 
      className={`flex ${
        message.role === 'assistant' 
          ? 'justify-start' 
          : message.role === 'user' 
            ? 'justify-end' 
            : 'justify-center'
      }`}
    >
      <div className={`max-w-3xl p-3 rounded-lg ${
        message.role === 'assistant' 
          ? 'bg-slate-100 text-slate-800' 
          : message.role === 'user'
            ? 'bg-blue-600 text-white'
            : 'bg-amber-50 border border-amber-200 text-amber-800 w-full'
      }`}>
        {message.role === 'system' && (
          <div className="flex items-center mb-2">
            <Settings className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">System Message</span>
          </div>
        )}
        {message.role === 'assistant' ? (
          <div 
            className="prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: message.content ? sanitizeHTML(formatMessage(message.content)) : 'Thinking...' 
            }}
          />
        ) : (
          <div 
            className={message.role === 'system' 
              ? "prose prose-amber max-w-none text-sm" 
              : ""}
            dangerouslySetInnerHTML={{ 
              __html: message.role === 'system' && message.content
                ? sanitizeHTML(formatMessage(message.content))
                : sanitizeHTML(message.content || '')
            }}
          />
        )}
      </div>
    </div>
  );
};

export default MessageDisplay;
