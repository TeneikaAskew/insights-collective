
import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message, Profile, ConversationParticipant } from '@/types/supabase';
import { enrichProfileWithRoles } from '@/utils/profileUtils';

/**
 * Fetches all conversations for a user
 */
export const fetchUserConversations = async (userId: string) => {
  try {
    if (!userId) {
      console.error('fetchUserConversations called without userId');
      return [];
    }
    
    // First, get conversation IDs for the user
    const { data: participantData, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);
    
    if (participantError) {
      console.error('Error fetching participant data:', participantError);
      throw participantError;
    }
    
    if (!participantData || participantData.length === 0) {
      return [];
    }
    
    const conversationIds = participantData.map(p => p.conversation_id);
    
    // Fetch conversations with participants and last message
    const { data: conversationsData, error: conversationsError } = await supabase
      .from('conversations')
      .select(`
        id,
        subject,
        is_group,
        created_by,
        updated_at,
        created_at,
        participants:conversation_participants(
          id,
          user_id,
          conversation_id,
          added_at,
          profile:profiles(
            id,
            first_name,
            last_name,
            avatar_url,
            role
          )
        ),
        last_message:messages(
          id,
          sender_id,
          content,
          read,
          created_at
        )
        `)
      .in('id', conversationIds)
      .order('updated_at', { ascending: false })
      .limit(20);
    
    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError);
      throw conversationsError;
    }
    
    // Transform the data to match our expected types
    return conversationsData.map(conversation => ({
      ...conversation,
      participants: conversation.participants.map(p => ({
        ...p,
        profile: p.profile ? enrichProfileWithRoles(p.profile) : undefined
      })),
      last_message: conversation.last_message[0] || null
    })) as Conversation[];
  } catch (error) {
    console.error('Error in fetchUserConversations:', error);
    throw error;
  }
};

/**
 * Creates a new conversation
 */
export const createNewConversation = async (subject: string, recipientIds: string[]) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    console.log("[createNewConversation] Auth UID:", user.id, "Recipients:", recipientIds);

    // First create the conversation with the current user as creator
    const { data: conversationData, error: conversationError } = await supabase
      .from('conversations')
      .insert({
        subject,
        is_group: recipientIds.length > 1,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (conversationError) {
      console.error('[createNewConversation] Error creating conversation:', conversationError);
      throw conversationError;
    }

    if (!conversationData) {
      throw new Error('Failed to create conversation - no data returned');
    }

    console.log('[createNewConversation] Conversation created:', conversationData.id);
    
    // Add all recipients as participants
    const participantInserts = [
      // Include current user as participant
      {
        conversation_id: conversationData.id,
        user_id: user.id
      },
      // Add all other recipients
      ...recipientIds.map(recipientId => ({
        conversation_id: conversationData.id,
        user_id: recipientId
      }))
    ];
    
    console.log('[createNewConversation] Adding participants:', participantInserts);

    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .insert(participantInserts);
      
    if (participantsError) {
      console.error('[createNewConversation] Error adding participants:', participantsError);
      throw participantsError;
    }
    
    return conversationData.id;
  } catch (error) {
    console.error('[createNewConversation] Error:', error);
    throw error;
  }
};

/**
 * Sends a message in a conversation
 */
export const sendConversationMessage = async (userId: string, conversationId: string, content: string, attachmentUrl?: string) => {
  try {
    if (!userId || !conversationId || !content.trim()) {
      throw new Error('User ID, Conversation ID, and message content are required');
    }
    
    // Send message
    const { data: messageData, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        attachment_url: attachmentUrl || null
      })
      .select('id, created_at')
      .single();
    
    if (error) {
      console.error('Error sending message:', error);
      throw error;
    }
    
    // Update conversation updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    
    return messageData;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * Get or create a one-on-one conversation with another user
 * Completely refactored to properly check for existing conversations
 */
export const getOrCreateOneOnOneConversation = async (userId: string, otherUserId: string) => {
  try {
    console.log("Checking for existing conversation between", userId, "and", otherUserId);
    
    // First, check if there's a direct conversation between these two users
    const { data: sharedConversationsData, error: sharedError } = await supabase
      .from('conversations')
      .select(`
        id,
        is_group,
        participants:conversation_participants(user_id)
      `)
      .eq('is_group', false);
    
    if (sharedError) {
      console.error("Error finding conversations:", sharedError);
      throw sharedError;
    }
    
    if (sharedConversationsData && sharedConversationsData.length > 0) {
      // Filter to find conversations that have EXACTLY these two users as participants
      const matchingConversation = sharedConversationsData.find(conv => {
        // Get unique user IDs from participants
        const participantIds = conv.participants.map(p => p.user_id);
        
        // Check if there are exactly 2 participants and they match our users
        return participantIds.length === 2 && 
               participantIds.includes(userId) && 
               participantIds.includes(otherUserId);
      });
      
      if (matchingConversation) {
        console.log("Found existing conversation:", matchingConversation.id);
        return matchingConversation.id;
      }
    }
    
    console.log("No existing conversation found, creating new one");
    
    // Create a new conversation with the other user
    return await createNewConversationWithOtherUser(userId, otherUserId);
  } catch (error) {
    console.error("Error in getOrCreateOneOnOneConversation:", error);
    throw error;
  }
};

// Helper function to create a new conversation with another user
const createNewConversationWithOtherUser = async (userId: string, otherUserId: string) => {
  try {
    // Get the other user's name for the subject
    const { data: otherUser, error: userError } = await supabase
      .from('profiles')
      .select('first_name, last_name, avatar_url')
      .eq('id', otherUserId)
      .single();
      
    if (userError) {
      console.error("Error fetching other user:", userError);
      throw userError;
    }
    
    // Use a descriptive subject based on the other user's name
    const subject = otherUser ? 
      `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || 'New conversation' : 
      'New conversation';
    
    console.log("Creating new conversation with subject:", subject);
    
    // Create the conversation
    return await createNewConversation(subject, [otherUserId]);
  } catch (error) {
    console.error("Error creating new conversation:", error);
    throw error;
  }
};
