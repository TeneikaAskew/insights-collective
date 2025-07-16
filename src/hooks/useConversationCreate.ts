
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { createNewConversation } from '@/services/conversationService';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useConversationCreate');

/**
 * Hook for creating new conversations
 */
export function useConversationCreate() {
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const createConversation = async (subject: string, recipientIds: string[]) => {
    logger.log('[useConversationCreate] Attempting to create conversation');
    
    if (!user) {
      logger.warn('[useConversationCreate] No authenticated user found');
      toast({
        title: 'Error',
        description: 'You must be logged in to create a conversation',
        variant: 'destructive',
      });
      return null;
    }

    logger.log('[useConversationCreate] Subject:', subject);
    logger.log('[useConversationCreate] Recipients:', recipientIds);

    setCreating(true);
    try {
      // Use the updated createNewConversation function which handles auth internally
      const conversationId = await createNewConversation(subject, recipientIds);

      logger.log('[useConversationCreate] Successfully created conversation:', conversationId);
      return conversationId;
    } catch (error) {
      logger.error('[useConversationCreate] Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create conversation. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setCreating(false);
      logger.log('[useConversationCreate] Done creating conversation');
    }
  };
  
  return { 
    createConversation,
    creating
  };
}
