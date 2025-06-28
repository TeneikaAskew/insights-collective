
import { useConversationList } from './useConversationList';
import { useConversationCreate } from './useConversationCreate';
import { useMessageSend } from './useMessageSend';

/**
 * Combined hook for conversations functionality
 */
export function useConversations() {
  const { conversations, loading, error } = useConversationList();
  const { createConversation } = useConversationCreate();
  const { sendMessage } = useMessageSend();
  
  return { 
    conversations, 
    loading, 
    error,
    createConversation,
    sendMessage
  };
}
