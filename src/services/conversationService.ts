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
    // Destructure only data and error
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getDeletedConversations', userId }, // Use new action
    });

     // Check for invocation errors first
    if (error) {
      console.error('[fetchDeletedUserConversations] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to invoke messages-helper');
    }

     // Check if the function returned an error structure within its data payload
     if (data?.error) {
       console.error('[fetchDeletedUserConversations] Edge function returned error message:', data.error);
       throw new Error(data.error || 'Edge function failed');
     }

    console.log('[fetchDeletedUserConversations] Deleted conversations fetched:', data?.conversations?.length || 0); // Log count

    return (data?.conversations as Conversation[]) || []; // Cast to Conversation[]
  } catch (error) {
    console.error('[fetchDeletedUserConversations] Unexpected error:', error);
     throw error instanceof Error ? error : new Error('An unknown error occurred while fetching deleted conversations.');
  }
};

/**
 * Create a new conversation
 */
export const createConversation = async (subject: string, participantIds: string[], currentUserId: string) => {
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .insert({
      subject,
      is_group: participantIds.length > 1,
      created_by: currentUserId
    })
    .select()
    .single();
  
  if (conversationError) {
    console.error('Error creating conversation:', conversationError);
    throw conversationError;
  }
  
  // Add all participants including the creator
  const allParticipantIds = [...new Set([...participantIds, currentUserId])];
  
  const participants = allParticipantIds.map(userId => ({
    conversation_id: conversation.id,
    user_id: userId
  }));
  
  const { error: participantsError } = await supabase
    .from('conversation_participants')
    .insert(participants);
  
  if (participantsError) {
    console.error('Error adding participants:', participantsError);
    throw participantsError;
  }
  
  return conversation;
};

/**
 * Wrapper function for createConversation that matches the expected interface in useConversationCreate.ts
 */
export const createNewConversation = async (subject: string, participantIds: string[]) => {
  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated user found');
    }
    
    const conversation = await createConversation(subject, participantIds, user.id);
    return conversation.id;
  } catch (error) {
    console.error('Error in createNewConversation:', error);
    throw error;
  }
};

/**
 * Get or create a one-on-one conversation between two users
 */
export const getOrCreateOneOnOneConversation = async (currentUserId: string, otherUserId: string) => {
  try {
    console.log('Checking for existing conversation between', currentUserId, 'and', otherUserId);
    
    // First, check if there's already a one-on-one conversation between these users
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'checkOneOnOneConversation',
        currentUserId,
        otherUserId
      },
    });
    
    if (error) {
      console.error('Error checking for existing conversations:', error);
      throw error;
    }
    
    // If a conversation exists, return its ID
    if (data?.conversation?.id) {
      console.log('Found existing conversation:', data.conversation.id);
      return data.conversation.id;
    }
    
    // Otherwise, create a new one-on-one conversation
    console.log('No existing conversation found, creating new one');
    const otherUser = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', otherUserId)
      .single();
      
    if (otherUser.error) {
      throw otherUser.error;
    }
    
    const subject = `Chat with ${otherUser.data.first_name} ${otherUser.data.last_name}`;
    const conversation = await createConversation(subject, [otherUserId], currentUserId);
    
    console.log('Created new conversation:', conversation.id);
    return conversation.id;
  } catch (error) {
    console.error('Error in getOrCreateOneOnOneConversation:', error);
    throw error;
  }
};

/**
 * Fetch messages for a specific conversation
 */
export const fetchMessages = async (conversationId: string): Promise<Message[]> => { // Added return type
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getMessages', conversationId },
    });

    if (error) {
       console.error('[fetchMessages] Edge function invocation error:', error);
       throw new Error(error.message || 'Failed to invoke messages-helper');
    }
     if (data?.error) {
         console.error('[fetchMessages] Edge function returned error message:', data.error);
         throw new Error(data.error || 'Edge function failed');
     }

    return (data?.messages as Message[]) || []; // Cast to Message[]
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
};

/**
 * Send a new message in a conversation
 */
export const sendMessage = async (conversationId: string, content: string, senderId: string) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content,
        sender_id: senderId
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Update the conversation's updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * Wrapper for sendMessage that matches the expected interface in useMessageSend.ts
 */
export const sendConversationMessage = async (senderId: string, conversationId: string, content: string, attachmentUrl?: string) => {
  return sendMessage(conversationId, content, senderId);
};

/**
 * Helper function to update conversation properties using the Edge Function
 */
const updateConversationViaEdgeFunction = async (conversationId: string, userId: string, updates: any) => {
   console.log(`[updateConversationViaEdgeFunction] Attempting update for conv ${conversationId}, user ${userId}`, updates);
   if (!userId || !conversationId) {
     console.error('[updateConversationViaEdgeFunction] Error: userId or conversationId is missing.');
     throw new Error('User ID and Conversation ID are required.');
   }
  try {
    console.log('[updateConversationViaEdgeFunction] Invoking messages-helper with action: updateConversation');
    // Destructure only data and error
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: {
        action: 'updateConversation',
        conversationId,
        userId,
        updates
      },
    });

     // Check for invocation errors first
    if (error) {
       console.error('[updateConversationViaEdgeFunction] Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to invoke messages-helper');
    }

     // Check if the function returned an error structure within its data payload
     if (data?.error) {
       console.error('[updateConversationViaEdgeFunction] Edge function returned error message:', data.error);
       throw new Error(data.error || `Edge function failed`);
     }

     // Log warning if the update didn't return data (might indicate RLS issue or non-existent convo)
     // Note: The edge function might return null even on success if no conversation matched
     if (!data?.conversation) {
       console.warn(`[updateConversationViaEdgeFunction] Update for conv ${conversationId} might have failed or returned no data. Check if conversation exists and user has permissions.`);
     } else {
        console.log(`[updateConversationViaEdgeFunction] Successfully updated conv ${conversationId}.`);
     }

    return data?.conversation || null; // Return null if no conversation was updated/returned
  } catch (error) {
    console.error('[updateConversationViaEdgeFunction] Unexpected error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while updating conversation.');
  }
};

/**
 * Archive or unarchive a conversation
 */
export const updateConversationArchiveStatus = async (conversationId: string, archived: boolean) => {
  console.log(`[updateConversationArchiveStatus] Setting archived=${archived} for conv ${conversationId}`);
  try {
    // Get the current user ID
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('[updateConversationArchiveStatus] Error: No authenticated user found');
      throw new Error('No authenticated user found');
    }

    return await updateConversationViaEdgeFunction(conversationId, user.id, { archived });
  } catch (error) {
    console.error('[updateConversationArchiveStatus] Error:', error);
    throw error; // Re-throw original error
  }
};

/**
 * Archive a conversation - wrapper function for updateConversationArchiveStatus
 */
export const archiveConversation = async (conversationId: string, userId: string) => {
   console.log(`[archiveConversation] User ${userId} archiving conv ${conversationId}`);
   if (!userId || !conversationId) {
     console.error('[archiveConversation] Error: userId or conversationId missing.');
     throw new Error('User ID and Conversation ID are required.');
   }
  try {
    // The edge function now handles permission checks internally based on the passed userId
    return updateConversationViaEdgeFunction(conversationId, userId, { archived: true });
  } catch (error) {
    console.error('[archiveConversation] Error:', error);
    throw error;
  }
};

/**
 * Unarchive a conversation - wrapper function for updateConversationArchiveStatus
 */
export const unarchiveConversation = async (conversationId: string, userId: string) => {
   console.log(`[unarchiveConversation] User ${userId} unarchiving conv ${conversationId}`);
    if (!userId || !conversationId) {
     console.error('[unarchiveConversation] Error: userId or conversationId missing.');
     throw new Error('User ID and Conversation ID are required.');
   }
  try {
     // The edge function handles permission checks
    return updateConversationViaEdgeFunction(conversationId, userId, { archived: false });
  } catch (error) {
    console.error('[unarchiveConversation] Error:', error);
    throw error;
  }
};

/**
* Delete a conversation (sets deleted_at) - New Function
*/
export const deleteConversation = async (conversationId: string, userId: string) => {
  console.log(`[deleteConversation] User ${userId} deleting conv ${conversationId}`);
   if (!userId || !conversationId) {
     console.error('[deleteConversation] Error: userId or conversationId missing.');
     throw new Error('User ID and Conversation ID are required.');
   }
  try {
    // The edge function handles permission checks
    return updateConversationViaEdgeFunction(conversationId, userId, { deleted_at: new Date().toISOString() });
  } catch (error) {
    console.error('[deleteConversation] Error:', error);
    throw error;
  }
};

/**
* Restore a conversation (sets deleted_at to null) - New Function
*/
export const restoreConversation = async (conversationId: string, userId: string) => {
   console.log(`[restoreConversation] User ${userId} restoring conv ${conversationId}`);
    if (!userId || !conversationId) {
     console.error('[restoreConversation] Error: userId or conversationId missing.');
     throw new Error('User ID and Conversation ID are required.');
   }
  try {
    // The edge function handles permission checks
    return updateConversationViaEdgeFunction(conversationId, userId, { deleted_at: null });
  } catch (error) {
    console.error('[restoreConversation] Error:', error);
    throw error;
  }
};
