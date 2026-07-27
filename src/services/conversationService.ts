import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message } from '@/types/supabase'; // Import Conversation and Message types
import { createLogger } from '@/utils/logger';

const logger = createLogger('conversationService');

/**
 * Wait for supabase-js to have attached a session before invoking the function.
 *
 * `functions.invoke` sends whatever bearer the client currently holds. On a cold
 * load the hooks fire from a mount effect that can beat session restoration, so
 * the call goes out with the anon key and messages-helper answers
 * `401 Not authorized` — surfacing as "Edge Function returned a non-2xx status
 * code" on the inbox for a fraction of loads. Verified directly against the
 * live function: a member token returns 200 (with or without `userId`), the
 * anon key returns 401.
 *
 * `getSession()` resolves once restoration has completed, so awaiting it is both
 * the wait and the check. This is the same race that made `enrollments` answer
 * 42501 on every public page.
 */
async function requireSession(where: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    logger.log(`[${where}] no session yet — skipping the call rather than sending the anon key`);
    return false;
  }
  return true;
}

/**
 * Fetch conversations for a specific user (non-archived, non-deleted)
 */
export const fetchUserConversations = async (userId: string): Promise<Conversation[]> => { // Add return type
  logger.log('[fetchUserConversations] Attempting for user:', userId);
  if (!userId) {
    logger.error('[fetchUserConversations] Error: userId is missing.');
    throw new Error('User ID is required to fetch conversations.');
  }
  try {
    logger.log('[fetchUserConversations] Invoking messages-helper with action: getConversations');
    // Destructure only data and error, as status is not directly available here
    if (!(await requireSession('fetchUserConversations'))) return [];

    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getConversations', userId },
    });

    // Check for invocation errors first
    if (error) {
      logger.error('[fetchUserConversations] Edge function invocation error:', error);
      // The error object often contains details, including potentially a status if it was an HTTP-level issue during invoke
      throw new Error(error.message || 'Failed to invoke messages-helper');
    }

     // Check if the function returned an error structure within its data payload
     if (data?.error) {
       logger.error('[fetchUserConversations] Edge function returned error message:', data.error);
       throw new Error(data.error || 'Edge function failed');
     }

    logger.log('[fetchUserConversations] Active conversations fetched:', data?.conversations?.length || 0);
    return (data?.conversations as Conversation[]) || []; // Cast to Conversation[]
  } catch (error) {
    logger.error('[fetchUserConversations] Unexpected error:', error);
    // Re-throw the specific error rather than a generic one if possible
    throw error instanceof Error ? error : new Error('An unknown error occurred while fetching conversations.');
  }
};

/**
 * Fetch archived conversations for a specific user (non-deleted)
 */
export const fetchArchivedUserConversations = async (userId: string): Promise<Conversation[]> => { // Add return type
  logger.log('[fetchArchivedUserConversations] Attempting for user:', userId);
  if (!userId) {
    logger.error('[fetchArchivedUserConversations] Error: userId is missing.');
    throw new Error('User ID is required to fetch archived conversations.');
  }
  try {
     logger.log('[fetchArchivedUserConversations] Invoking messages-helper with action: getArchivedConversations');
     // Destructure only data and error
    if (!(await requireSession('fetchArchivedUserConversations'))) return [];

    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getArchivedConversations', userId },
    });

     // Check for invocation errors first
    if (error) {
      logger.error('[fetchArchivedUserConversations] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to invoke messages-helper');
    }

      // Check if the function returned an error structure within its data payload
     if (data?.error) {
       logger.error('[fetchArchivedUserConversations] Edge function returned error message:', data.error);
       throw new Error(data.error || 'Edge function failed');
     }

     logger.log('[fetchArchivedUserConversations] Archived conversations fetched:', data?.conversations?.length || 0); // Log count

    return (data?.conversations as Conversation[]) || []; // Cast to Conversation[]
  } catch (error) {
    logger.error('[fetchArchivedUserConversations] Unexpected error:', error);
     throw error instanceof Error ? error : new Error('An unknown error occurred while fetching archived conversations.');
  }
};

/**
 * Fetch deleted conversations for a specific user
 */
export const fetchDeletedUserConversations = async (userId: string): Promise<Conversation[]> => { // Add return type
  logger.log('[fetchDeletedUserConversations] Attempting for user:', userId);
   if (!userId) {
     logger.error('[fetchDeletedUserConversations] Error: userId is missing.');
     throw new Error('User ID is required to fetch deleted conversations.');
   }
  try {
    logger.log('[fetchDeletedUserConversations] Invoking messages-helper with action: getDeletedConversations');
    if (!(await requireSession('fetchDeletedUserConversations'))) return [];

    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getDeletedConversations', userId },
    });

    if (error) {
      logger.error('[fetchDeletedUserConversations] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to invoke messages-helper');
    }

    if (data?.error) {
      logger.error('[fetchDeletedUserConversations] Edge function returned error message:', data.error);
      throw new Error(data.error || 'Edge function failed');
    }

    logger.log('[fetchDeletedUserConversations] Deleted conversations fetched:', data?.conversations?.length || 0);
    return (data?.conversations as Conversation[]) || [];
  } catch (error) {
    logger.error('[fetchDeletedUserConversations] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while fetching deleted conversations.');
  }
};

/**
 * Create a new conversation
 */
export const createNewConversation = async (subject: string, recipientIds: string[], currentUserId?: string): Promise<string | null> => {
  logger.log('[createNewConversation] Creating conversation with subject:', subject);
  logger.log('[createNewConversation] Recipients:', recipientIds);
  logger.log('[createNewConversation] Current user:', currentUserId);
  
  try {
    // Get current user if not provided
    if (!currentUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required to create conversation');
      }
      currentUserId = user.id;
    }

    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'createConversation', 
        subject, 
        recipientIds,
        currentUserId 
      },
    });

    if (error) {
      logger.error('[createNewConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to create conversation');
    }

    if (data?.error) {
      logger.error('[createNewConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to create conversation');
    }

    logger.log('[createNewConversation] Successfully created conversation:', data?.conversationId);
    return data?.conversationId || null;
  } catch (error) {
    logger.error('[createNewConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while creating conversation.');
  }
};

/**
 * Get or create a one-on-one conversation between two users
 */
export const getOrCreateOneOnOneConversation = async (currentUserId: string, otherUserId: string): Promise<string | null> => {
  logger.log('[getOrCreateOneOnOneConversation] Checking for existing conversation between:', currentUserId, 'and', otherUserId);
  
  try {
    // First check if a one-on-one conversation already exists
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'checkOneOnOneConversation', 
        currentUserId, 
        otherUserId 
      },
    });

    if (error) {
      logger.error('[getOrCreateOneOnOneConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to check existing conversation');
    }

    if (data?.error) {
      logger.error('[getOrCreateOneOnOneConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to check existing conversation');
    }

    if (data?.conversationId) {
      logger.log('[getOrCreateOneOnOneConversation] Found existing conversation:', data.conversationId);
      return data.conversationId;
    }

    // If no existing conversation, create a new one
    logger.log('[getOrCreateOneOnOneConversation] No existing conversation found, creating new one');
    return await createNewConversation('', [otherUserId], currentUserId);
  } catch (error) {
    logger.error('[getOrCreateOneOnOneConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while getting or creating conversation.');
  }
};

/**
 * Send a message in a conversation
 */
export const sendConversationMessage = async (senderId: string, conversationId: string, content: string, attachmentUrl?: string): Promise<void> => {
  logger.log('[sendConversationMessage] Sending message in conversation:', conversationId);
  
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'sendMessage', 
        senderId,
        conversationId, 
        content,
        attachmentUrl 
      },
    });

    if (error) {
      logger.error('[sendConversationMessage] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to send message');
    }

    if (data?.error) {
      logger.error('[sendConversationMessage] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to send message');
    }

    logger.log('[sendConversationMessage] Message sent successfully');
  } catch (error) {
    logger.error('[sendConversationMessage] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while sending message.');
  }
};

/**
 * Archive a conversation for a user
 */
export const archiveConversation = async (conversationId: string, userId: string): Promise<void> => {
  logger.log('[archiveConversation] Archiving conversation:', conversationId, 'for user:', userId);
  
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'archiveConversation', 
        conversationId, 
        userId 
      },
    });

    if (error) {
      logger.error('[archiveConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to archive conversation');
    }

    if (data?.error) {
      logger.error('[archiveConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to archive conversation');
    }

    logger.log('[archiveConversation] Conversation archived successfully');
  } catch (error) {
    logger.error('[archiveConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while archiving conversation.');
  }
};

/**
 * Unarchive a conversation for a user
 */
export const unarchiveConversation = async (conversationId: string, userId: string): Promise<void> => {
  logger.log('[unarchiveConversation] Unarchiving conversation:', conversationId, 'for user:', userId);
  
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'unarchiveConversation', 
        conversationId, 
        userId 
      },
    });

    if (error) {
      logger.error('[unarchiveConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to unarchive conversation');
    }

    if (data?.error) {
      logger.error('[unarchiveConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to unarchive conversation');
    }

    logger.log('[unarchiveConversation] Conversation unarchived successfully');
  } catch (error) {
    logger.error('[unarchiveConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while unarchiving conversation.');
  }
};

/**
 * Delete a conversation for a user
 */
export const deleteConversation = async (conversationId: string, userId: string): Promise<void> => {
  logger.log('[deleteConversation] Deleting conversation:', conversationId, 'for user:', userId);
  
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'deleteConversation', 
        conversationId, 
        userId 
      },
    });

    if (error) {
      logger.error('[deleteConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to delete conversation');
    }

    if (data?.error) {
      logger.error('[deleteConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to delete conversation');
    }

    logger.log('[deleteConversation] Conversation deleted successfully');
  } catch (error) {
    logger.error('[deleteConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while deleting conversation.');
  }
};

/**
 * Restore a deleted conversation for a user
 */
export const restoreConversation = async (conversationId: string, userId: string): Promise<void> => {
  logger.log('[restoreConversation] Restoring conversation:', conversationId, 'for user:', userId);
  
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'restoreConversation', 
        conversationId, 
        userId 
      },
    });

    if (error) {
      logger.error('[restoreConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to restore conversation');
    }

    if (data?.error) {
      logger.error('[restoreConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to restore conversation');
    }

    logger.log('[restoreConversation] Conversation restored successfully');
  } catch (error) {
    logger.error('[restoreConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while restoring conversation.');
  }
};
