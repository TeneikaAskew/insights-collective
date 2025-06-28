
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { createNewConversation } from '@/services/conversationService';

/**
 * Hook for creating new conversations
 */
export function useConversationCreate() {
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const createConversation = async (subject: string, recipientIds: string[]) => {
    console.log('[useConversationCreate] Attempting to create conversation');
    
    if (!user) {
      console.warn('[useConversationCreate] No authenticated user found');
      toast({
        title: 'Error',
        description: 'You must be logged in to create a conversation',
        variant: 'destructive',
      });
      return null;
    }

    console.log('[useConversationCreate] Subject:', subject);
    console.log('[useConversationCreate] Recipients:', recipientIds);

    setCreating(true);
    try {
      // Use the updated createNewConversation function which handles auth internally
      const conversationId = await createNewConversation(subject, recipientIds);

      console.log('[useConversationCreate] Successfully created conversation:', conversationId);
      return conversationId;
    } catch (error) {
      console.error('[useConversationCreate] Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create conversation. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setCreating(false);
      console.log('[useConversationCreate] Done creating conversation');
    }
  };
  
  return { 
    createConversation,
    creating
  };
}
