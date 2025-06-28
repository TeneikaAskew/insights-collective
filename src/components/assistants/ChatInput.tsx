
import React from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PersonalizationSettings } from './types';

interface ChatInputProps {
  inputValue: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: (settings: PersonalizationSettings) => void;
  personalizationSettings: PersonalizationSettings;
}

const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  isLoading,
  onInputChange,
  onSendMessage,
  personalizationSettings
}) => {
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage(personalizationSettings);
    }
  };
  
  return (
    <div className="p-4 border-t">
      <div className="flex space-x-2">
        <Textarea
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message here..."
          className="flex-1 resize-none"
          rows={2}
        />
        <Button 
          onClick={() => onSendMessage(personalizationSettings)} 
          disabled={isLoading || !inputValue.trim()}
          className="self-end"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </div>
  );
};

export default ChatInput;
