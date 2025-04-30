
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch conversations for a specific user
 */
export const fetchUserConversations = async (userId: string) => {
  try {
    console.log('Fetching conversations for user:', userId);
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getConversations', userId },
    });
    
    if (error) {
      console.error('Error fetching conversations:', error);
      throw new Error(error.message);
    }
    
    console.log('Conversations fetched:', data?.conversations?.length || 0);
    return data?.conversations || [];
  } catch (error) {
    console.error('Error in fetchUserConversations:', error);
    throw error;
  }
};

/**
 * Fetch archived conversations for a specific user
 */
export const fetchArchivedUserConversations = async (userId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('messages-helper', {
      body: { action: 'getArchivedConversations', userId },
    });
    
    if (error) {
      console.error('Error fetching archived conversations:', error);
      throw new Error(error.message);
    }
    
    return data?.conversations || [];
  } catch (error) {
    console.error('Error in fetchArchivedUserConversations:', error);
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
 * Archive or unarchive a conversation
 */
export const updateConversationArchiveStatus = async (conversationId: string, archived: boolean) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .update({ archived })
      .eq('id', conversationId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating conversation archive status:', error);
    throw error;
  }
};
