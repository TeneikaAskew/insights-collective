
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { sendConversationMessage } from '@/services/conversationService';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useMessageSend');

/**
 * Hook for sending messages in a conversation
 */
export function useMessageSend() {
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const sendMessage = async (conversationId: string, content: string, attachmentUrl?: string) => {
    if (!user) return false;
    
    setSending(true);
    try {
      await sendConversationMessage(user.id, conversationId, content, attachmentUrl);
      return true;
    } catch (error) {
      logger.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSending(false);
    }
  };
  
  return { 
    sendMessage,
    sending
  };
}
