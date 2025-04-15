import React from 'react';

interface MessageBadgeProps {
  count: number;
  className?: string;
}

const MessageBadge: React.FC<MessageBadgeProps> = ({ count, className = '' }) => {
  if (count <= 0) return null;
  
  return (
    <div className={`bg-red-500 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center px-1 ${className}`}>
      {count > 99 ? '99+' : count}
    </div>
  );
};

export default MessageBadge;
