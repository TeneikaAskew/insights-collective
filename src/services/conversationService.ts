import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message } from '@/types/supabase'; // Import Conversation and Message types

/**
 * Fetch conversations for a specific user (non-archived, non-deleted)
 */
export const fetchUserConversations = async (userId: string): Promise<Conversation[]> => { // Add return type
  console.log('[fetchUserConversations] Attempting for user:', userId);
  if (!userId) {
    console.error('[fetchUserConversations] Error: userId is missing.');
    throw new Error('User ID is required to fetch conversations.');
  }
  try {
    console.log('[fetchUserConversations] Invoking messages-helper with action: getConversations');
    // Destructure only data and error, as status is not directly available here
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getConversations', userId },
    });

    // Check for invocation errors first
    if (error) {
      console.error('[fetchUserConversations] Edge function invocation error:', error);
      // The error object often contains details, including potentially a status if it was an HTTP-level issue during invoke
      throw new Error(error.message || 'Failed to invoke messages-helper');
    }

     // Check if the function returned an error structure within its data payload
     if (data?.error) {
       console.error('[fetchUserConversations] Edge function returned error message:', data.error);
       throw new Error(data.error || 'Edge function failed');
     }

    console.log('[fetchUserConversations] Active conversations fetched:', data?.conversations?.length || 0);
    return (data?.conversations as Conversation[]) || []; // Cast to Conversation[]
  } catch (error) {
    console.error('[fetchUserConversations] Unexpected error:', error);
    // Re-throw the specific error rather than a generic one if possible
    throw error instanceof Error ? error : new Error('An unknown error occurred while fetching conversations.');
  }
};

/**
 * Fetch archived conversations for a specific user (non-deleted)
 */
export const fetchArchivedUserConversations = async (userId: string): Promise<Conversation[]> => { // Add return type
  console.log('[fetchArchivedUserConversations] Attempting for user:', userId);
  if (!userId) {
    console.error('[fetchArchivedUserConversations] Error: userId is missing.');
    throw new Error('User ID is required to fetch archived conversations.');
  }
  try {
     console.log('[fetchArchivedUserConversations] Invoking messages-helper with action: getArchivedConversations');
     // Destructure only data and error
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getArchivedConversations', userId },
    });

     // Check for invocation errors first
    if (error) {
      console.error('[fetchArchivedUserConversations] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to invoke messages-helper');
    }

      // Check if the function returned an error structure within its data payload
     if (data?.error) {
       console.error('[fetchArchivedUserConversations] Edge function returned error message:', data.error);
       throw new Error(data.error || 'Edge function failed');
     }

     console.log('[fetchArchivedUserConversations] Archived conversations fetched:', data?.conversations?.length || 0); // Log count

    return (data?.conversations as Conversation[]) || []; // Cast to Conversation[]
  } catch (error) {
    console.error('[fetchArchivedUserConversations] Unexpected error:', error);
     throw error instanceof Error ? error : new Error('An unknown error occurred while fetching archived conversations.');
  }
};

/**
 * Fetch deleted conversations for a specific user
 */
export const fetchDeletedUserConversations = async (userId: string): Promise<Conversation[]> => { // Add return type
  console.log('[fetchDeletedUserConversations] Attempting for user:', userId);
   if (!userId) {
     console.error('[fetchDeletedUserConversations] Error: userId is missing.');
     throw new Error('User ID is required to fetch deleted conversations.');
   }
  try {
    console.log('[fetchDeletedUserConversations] Invoking messages-helper with action: getDeletedConversations');
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getDeletedConversations', userId },
    });

    if (error) {
      console.error('[fetchDeletedUserConversations] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to invoke messages-helper');
    }

    if (data?.error) {
      console.error('[fetchDeletedUserConversations] Edge function returned error message:', data.error);
      throw new Error(data.error || 'Edge function failed');
    }

    console.log('[fetchDeletedUserConversations] Deleted conversations fetched:', data?.conversations?.length || 0);
    return (data?.conversations as Conversation[]) || [];
  } catch (error) {
    console.error('[fetchDeletedUserConversations] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while fetching deleted conversations.');
  }
};

/**
 * Create a new conversation
 */
export const createNewConversation = async (subject: string, recipientIds: string[], currentUserId?: string): Promise<string | null> => {
  console.log('[createNewConversation] Creating conversation with subject:', subject);
  console.log('[createNewConversation] Recipients:', recipientIds);
  console.log('[createNewConversation] Current user:', currentUserId);
  
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
      console.error('[createNewConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to create conversation');
    }

    if (data?.error) {
      console.error('[createNewConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to create conversation');
    }

    console.log('[createNewConversation] Successfully created conversation:', data?.conversationId);
    return data?.conversationId || null;
  } catch (error) {
    console.error('[createNewConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while creating conversation.');
  }
};

/**
 * Get or create a one-on-one conversation between two users
 */
export const getOrCreateOneOnOneConversation = async (currentUserId: string, otherUserId: string): Promise<string | null> => {
  console.log('[getOrCreateOneOnOneConversation] Checking for existing conversation between:', currentUserId, 'and', otherUserId);
  
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
      console.error('[getOrCreateOneOnOneConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to check existing conversation');
    }

    if (data?.error) {
      console.error('[getOrCreateOneOnOneConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to check existing conversation');
    }

    if (data?.conversationId) {
      console.log('[getOrCreateOneOnOneConversation] Found existing conversation:', data.conversationId);
      return data.conversationId;
    }

    // If no existing conversation, create a new one
    console.log('[getOrCreateOneOnOneConversation] No existing conversation found, creating new one');
    return await createNewConversation('', [otherUserId], currentUserId);
  } catch (error) {
    console.error('[getOrCreateOneOnOneConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while getting or creating conversation.');
  }
};

/**
 * Send a message in a conversation
 */
export const sendConversationMessage = async (senderId: string, conversationId: string, content: string, attachmentUrl?: string): Promise<void> => {
  console.log('[sendConversationMessage] Sending message in conversation:', conversationId);
  
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
      console.error('[sendConversationMessage] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to send message');
    }

    if (data?.error) {
      console.error('[sendConversationMessage] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to send message');
    }

    console.log('[sendConversationMessage] Message sent successfully');
  } catch (error) {
    console.error('[sendConversationMessage] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while sending message.');
  }
};

/**
 * Archive a conversation for a user
 */
export const archiveConversation = async (conversationId: string, userId: string): Promise<void> => {
  console.log('[archiveConversation] Archiving conversation:', conversationId, 'for user:', userId);
  
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'archiveConversation', 
        conversationId, 
        userId 
      },
    });

    if (error) {
      console.error('[archiveConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to archive conversation');
    }

    if (data?.error) {
      console.error('[archiveConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to archive conversation');
    }

    console.log('[archiveConversation] Conversation archived successfully');
  } catch (error) {
    console.error('[archiveConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while archiving conversation.');
  }
};

/**
 * Unarchive a conversation for a user
 */
export const unarchiveConversation = async (conversationId: string, userId: string): Promise<void> => {
  console.log('[unarchiveConversation] Unarchiving conversation:', conversationId, 'for user:', userId);
  
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'unarchiveConversation', 
        conversationId, 
        userId 
      },
    });

    if (error) {
      console.error('[unarchiveConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to unarchive conversation');
    }

    if (data?.error) {
      console.error('[unarchiveConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to unarchive conversation');
    }

    console.log('[unarchiveConversation] Conversation unarchived successfully');
  } catch (error) {
    console.error('[unarchiveConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while unarchiving conversation.');
  }
};

/**
 * Delete a conversation for a user
 */
export const deleteConversation = async (conversationId: string, userId: string): Promise<void> => {
  console.log('[deleteConversation] Deleting conversation:', conversationId, 'for user:', userId);
  
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'deleteConversation', 
        conversationId, 
        userId 
      },
    });

    if (error) {
      console.error('[deleteConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to delete conversation');
    }

    if (data?.error) {
      console.error('[deleteConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to delete conversation');
    }

    console.log('[deleteConversation] Conversation deleted successfully');
  } catch (error) {
    console.error('[deleteConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while deleting conversation.');
  }
};

/**
 * Restore a deleted conversation for a user
 */
export const restoreConversation = async (conversationId: string, userId: string): Promise<void> => {
  console.log('[restoreConversation] Restoring conversation:', conversationId, 'for user:', userId);
  
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'restoreConversation', 
        conversationId, 
        userId 
      },
    });

    if (error) {
      console.error('[restoreConversation] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to restore conversation');
    }

    if (data?.error) {
      console.error('[restoreConversation] Edge function returned error:', data.error);
      throw new Error(data.error || 'Failed to restore conversation');
    }

    console.log('[restoreConversation] Conversation restored successfully');
  } catch (error) {
    console.error('[restoreConversation] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while restoring conversation.');
  }
};
