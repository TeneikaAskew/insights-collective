
import { useConversationList } from './useConversationList';
import { useConversationCreate } from './useConversationCreate';
import { useMessageSend } from './useMessageSend';

/**
 * Combined hook for conversations functionality
 */
export function useConversations() {
  const { conversations, loading } = useConversationList();
  const { createConversation } = useConversationCreate();
  const { sendMessage } = useMessageSend();
  
  return { 
    conversations, 
    loading, 
    createConversation,
    sendMessage
  };
}
