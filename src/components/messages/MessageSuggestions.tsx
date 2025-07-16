
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquarePlus, Sparkles } from 'lucide-react';
import { preWrittenMessages } from '@/utils/messageTemplates';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

import { createLogger } from '@/utils/logger';

const logger = createLogger('MessageSuggestions');

interface MessageSuggestionsProps {
  onSelectMessage: (message: string) => void;
  conversationId?: string;
  messages?: any[];
}

const MessageSuggestions: React.FC<MessageSuggestionsProps> = ({
  onSelectMessage,
  conversationId,
  messages
}) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = React.useState(false);

  const generateAIMessage = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-message', {
        body: {
          conversationHistory: messages,
          messageType: messages?.length ? 'followup' : 'initial'
        }
      });

      if (error) throw error;
      if (data.message) {
        onSelectMessage(data.message);
      }
    } catch (error) {
      logger.error('Error generating message:', error);
      toast({
        title: "Error",
        description: "Could not generate message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-2 border-t space-y-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {preWrittenMessages.map((message, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onSelectMessage(message)}
            className="whitespace-nowrap"
          >
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            {message.length > 30 ? message.substring(0, 30) + '...' : message}
          </Button>
        ))}
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={generateAIMessage}
        disabled={isGenerating}
        className="w-full"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        {isGenerating ? "Generating..." : "Generate AI Message"}
      </Button>
    </div>
  );
};

export default MessageSuggestions;
