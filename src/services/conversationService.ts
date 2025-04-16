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

    console.log("User ID: ", userId)
    
    if (participantError) {
      console.error('Error fetching participant data:', participantError);
      throw participantError;
    }
    
    if (!participantData || participantData.length === 0) {
      return [];
    }
    
    const conversationIds = participantData.map(p => p.conversation_id);
    console.log("Conversations: ", conversationIds)
    
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
        archived,
        deleted_at,
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
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(20);
    
    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError);
      throw conversationsError;
    }
    
    // Transform the data to match our expected types
    const typedConversations = conversationsData.map(conversation => ({
      ...conversation,
      participants: conversation.participants.map((p: any) => ({
        ...p,
        profile: p.profile ? enrichProfileWithRoles(p.profile) : undefined
      })),
      last_message: conversation.last_message[0] || null
    })) as Conversation[];
    
    return typedConversations;
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
    console.log('[Supabase Auth Session]', await supabase.auth.getSession());


    // First create the conversation with the current user as creator
    const { data: conversationData, error: conversationError } = await supabase
      .from('conversations')
      .insert({
        subject,
        is_group: recipientIds.length > 1,
        created_by: user.id, // This must match auth.uid() for RLS,
      })
      // , 
              // { returning: 'representation' });//{ returning: 'minimal' });  //)
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
 * Check if a one-on-one conversation already exists between two users
 */
export const findExistingOneOnOneConversation = async (userId: string, otherUserId: string) => {
  try {
    // Get conversations where current user is a participant
    const { data: userConversations, error: userError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);
      
    if (userError) throw userError;
    if (!userConversations || userConversations.length === 0) return null;
    
    const conversationIds = userConversations.map(c => c.conversation_id);
    
    // Find conversations where other user is also a participant
    const { data: sharedConversations, error: sharedError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', conversationIds);
      
    if (sharedError) throw sharedError;
    if (!sharedConversations || sharedConversations.length === 0) return null;
    
    const sharedIds = sharedConversations.map(c => c.conversation_id);
    
    // Find non-group conversations among shared conversations
    const { data: nonGroupConvs, error: groupError } = await supabase
      .from('conversations')
      .select('id')
      .in('id', sharedIds)
      .eq('is_group', false);
      
    if (groupError) throw groupError;
    if (!nonGroupConvs || nonGroupConvs.length === 0) return null;
    
    // Return the first matching conversation
    return nonGroupConvs[0].id;
  } catch (error) {
    console.error('Error finding existing conversation:', error);
    return null;
  }
};

/**
 * Get or create a one-on-one conversation with another user
 */
export const getOrCreateOneOnOneConversation = async (userId: string, otherUserId: string) => {
  try {
    // First try to find existing conversation
    const existingConversationId = await findExistingOneOnOneConversation(userId, otherUserId);
    
    if (existingConversationId) {
      console.log("Found existing conversation:", existingConversationId);
      return existingConversationId;
    }
    console.log(`No existing conversation found, creating new one: User: ${userId} Other: ${otherUserId}`);
    
    // If no existing conversation, create a new one
    const { data: otherUser, error: userError } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', otherUserId)
      .single();
      
    if (userError) {
      console.error("Error fetching other user:", userError);
      throw userError;
    }
    
    const subject = otherUser ? 
      `${otherUser.first_name} ${otherUser.last_name}` : 
      'New conversation';
    
    // Now just call our main function which handles authentication properly
    return await createNewConversation(subject, [otherUserId]);
  } catch (error) {
    console.error('Error in getOrCreateOneOnOneConversation:', error);
    throw error;
  }
};
