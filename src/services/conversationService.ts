import { supabase } from '@/integrations/supabase/client';
import { Conversation } from '@/types/supabase'; // Import Conversation type

/**
 * Fetch conversations for a specific user (non-archived, non-deleted)
 */
export const fetchUserConversations = async (userId: string): Promise<Conversation[]> => { // Add return type
  try {
    console.log('Fetching active conversations for user:', userId);
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getConversations', userId },
    });

    if (error) {
      console.error('Error fetching active conversations:', error);
      throw new Error(error.message);
    }

    console.log('Active conversations fetched:', data?.conversations?.length || 0);
    return (data?.conversations as Conversation[]) || []; // Cast to Conversation[]
  } catch (error) {
    console.error('Error in fetchUserConversations:', error);
    throw error;
  }
};

/**
 * Fetch archived conversations for a specific user (non-deleted)
 */
export const fetchArchivedUserConversations = async (userId: string): Promise<Conversation[]> => { // Add return type
  try {
    console.log('Fetching archived conversations for user:', userId); // Log clarification
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getArchivedConversations', userId },
    });

    if (error) {
      console.error('Error fetching archived conversations:', error);
      throw new Error(error.message);
    }
     console.log('Archived conversations fetched:', data?.conversations?.length || 0); // Log count

    return (data?.conversations as Conversation[]) || []; // Cast to Conversation[]
  } catch (error) {
    console.error('Error in fetchArchivedUserConversations:', error);
    throw error;
  }
};

/**
 * Fetch deleted conversations for a specific user
 */
export const fetchDeletedUserConversations = async (userId: string): Promise<Conversation[]> => { // Add return type
  try {
    console.log('Fetching deleted conversations for user:', userId);
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getDeletedConversations', userId }, // Use new action
    });

    if (error) {
      console.error('Error fetching deleted conversations:', error);
      throw new Error(error.message);
    }
    console.log('Deleted conversations fetched:', data?.conversations?.length || 0); // Log count

    return (data?.conversations as Conversation[]) || []; // Cast to Conversation[]
  } catch (error) {
    console.error('Error in fetchDeletedUserConversations:', error);
    throw error;
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
export const fetchMessages = async (conversationId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getMessages', conversationId },
    });
    
    if (error) throw new Error(error.message);
    return data?.messages || [];
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
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { 
        action: 'updateConversation', 
        conversationId, 
        userId,
        updates
      },
    });

    if (error) throw error;
    return data?.conversation || null;
  } catch (error) {
    console.error('Error updating conversation via edge function:', error);
    throw error;
  }
};

/**
 * Archive or unarchive a conversation
 */
export const updateConversationArchiveStatus = async (conversationId: string, archived: boolean) => {
  try {
    // Get the current user ID
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated user found');
    }
    
    return await updateConversationViaEdgeFunction(conversationId, user.id, { archived });
  } catch (error) {
    console.error('Error updating conversation archive status:', error);
    throw error;
  }
};

/**
 * Archive a conversation - wrapper function for updateConversationArchiveStatus
 */
export const archiveConversation = async (conversationId: string, userId: string) => {
  try {
    // Check if user is allowed to archive this conversation
    const { data: participant, error: checkError } = await supabase
      .from('conversation_participants')
      .select()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();
      
    if (checkError || !participant) {
      throw new Error('You do not have permission to archive this conversation');
    }
    
    return updateConversationViaEdgeFunction(conversationId, userId, { archived: true });
  } catch (error) {
    console.error('Error archiving conversation:', error);
    throw error;
  }
};

/**
 * Unarchive a conversation - wrapper function for updateConversationArchiveStatus
 */
export const unarchiveConversation = async (conversationId: string, userId: string) => {
  try {
    // Check if user is allowed to unarchive this conversation
    const { data: participant, error: checkError } = await supabase
      .from('conversation_participants')
      .select()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();
      
    if (checkError || !participant) {
      throw new Error('You do not have permission to unarchive this conversation');
    }
    
    return updateConversationViaEdgeFunction(conversationId, userId, { archived: false });
  } catch (error) {
    console.error('Error unarchiving conversation:', error);
    throw error;
  }
};

/**
* Delete a conversation (sets deleted_at) - New Function
*/
export const deleteConversation = async (conversationId: string, userId: string) => {
  try {
    // Check if user is allowed to delete this conversation
    const { data: participant, error: checkError } = await supabase
      .from('conversation_participants')
      .select()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking participation:", checkError);
      throw new Error('Could not verify participation to delete conversation.');
    }

    if (!participant) {
      console.warn(`User ${userId} attempted to delete conversation ${conversationId} they are not part of.`);
      throw new Error('You do not have permission to delete this conversation');
    }

    return updateConversationViaEdgeFunction(conversationId, userId, { deleted_at: new Date().toISOString() });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw error;
  }
};

/**
* Restore a conversation (sets deleted_at to null) - New Function
*/
export const restoreConversation = async (conversationId: string, userId: string) => {
  try {
    // Check if user is allowed to restore this conversation
    const { data: participant, error: checkError } = await supabase
      .from('conversation_participants')
      .select()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking participation:", checkError);
      throw new Error('Could not verify participation to restore conversation.');
    }

    if (!participant) {
      console.warn(`User ${userId} attempted to restore conversation ${conversationId} they are not part of.`);
      throw new Error('You do not have permission to restore this conversation');
    }

    return updateConversationViaEdgeFunction(conversationId, userId, { deleted_at: null });
  } catch (error) {
    console.error('Error restoring conversation:', error);
    throw error;
  }
};
