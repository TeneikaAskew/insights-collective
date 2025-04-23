
import React from 'react';
import { Message } from './types';
import { formatMessage } from './utils/messageFormatting';

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
      <div className={`max-w-2xl p-3 rounded-lg ${
        message.role === 'assistant' 
          ? 'bg-slate-100 text-slate-800' 
          : message.role === 'user'
            ? 'bg-blue-600 text-white'
            : 'bg-blue-50 border border-blue-200 text-blue-800 w-full'
      }`}>
        {message.role === 'system' ? (
          <div className="prose prose-blue max-w-none text-sm">
            {formatMessage(message.content)}
          </div>
        ) : (
          <div className={message.role === 'assistant' 
            ? "prose prose-slate max-w-none" 
            : ""}>
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageDisplay;
