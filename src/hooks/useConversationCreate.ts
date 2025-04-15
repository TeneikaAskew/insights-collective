
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
    console.log(user.id, subject, recipientIds)
    if (!user) return null;
    
    setCreating(true);
    try {
      
      const conversationId = await createNewConversation(user.id, subject, recipientIds);
      
      return conversationId;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create conversation. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setCreating(false);
    }
  };
  
  return { 
    createConversation,
    creating
  };
}
