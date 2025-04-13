import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message, Profile, ConversationParticipant } from '@/types/supabase';

/**
 * Fetches all conversations for a user
 */
export const fetchUserConversations = async (userId: string) => {
  try {
    // Get all conversations where the user is a participant
    const { data: participantData, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);
    
    if (participantError) throw participantError;
    
    if (participantData.length === 0) {
      return [];
    }
    
    const conversationIds = participantData.map(p => p.conversation_id);
    
    // Get conversation details
    const { data: conversationsData, error: conversationsError } = await supabase
      .from('conversations')
      .select(`
        id, 
        subject, 
        is_group, 
        created_by,
        created_at,
        updated_at
      `)
      .in('id', conversationIds)
      .order('updated_at', { ascending: false });
      
    if (conversationsError) throw conversationsError;
    
    // Process each conversation individually to avoid relation errors
    const enrichedConversations: Conversation[] = [];
    
    for (const conversation of conversationsData) {
      // Get participants for this conversation
      const { data: participantsData, error: participantsError } = await supabase
        .from('conversation_participants')
        .select(`
          id,
          conversation_id,
          user_id,
          added_at
        `)
        .eq('conversation_id', conversation.id);
        
      if (participantsError) throw participantsError;
      
      // Get profiles for each participant
      const participantsWithProfiles: ConversationParticipant[] = [];
      
      for (const participant of participantsData) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', participant.user_id)
          .single();
          
        participantsWithProfiles.push({
          ...participant,
          profile: profileError ? undefined : profileData
        });
      }
      
      // Get latest message for this conversation
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          conversation_id,
          content,
          read,
          created_at
        `)
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      let lastMessage: Message | undefined = undefined;
      
      if (!messageError && messageData) {
        lastMessage = messageData as Message;
      }
      
      enrichedConversations.push({
        ...conversation,
        participants: participantsWithProfiles,
        last_message: lastMessage
      });
    }
    
    return enrichedConversations;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

/**
 * Creates a new conversation
 */
export const createNewConversation = async (userId: string, subject: string, recipientIds: string[]) => {
  try {
    // Create conversation
    const { data: conversationData, error: conversationError } = await supabase
      .from('conversations')
      .insert({
        subject,
        is_group: recipientIds.length > 1,
        created_by: userId
      })
      .select('id')
      .single();
    
    if (conversationError) throw conversationError;
    
    if (!conversationData) {
      throw new Error('Failed to create conversation');
    }
    
    // Add current user as participant
    await supabase
      .from('conversation_participants')
      .insert({
        conversation_id: conversationData.id,
        user_id: userId
      });
    
    // Add all recipients as participants
    const participantInserts = recipientIds.map(recipientId => ({
      conversation_id: conversationData.id,
      user_id: recipientId
    }));
    
    await supabase
      .from('conversation_participants')
      .insert(participantInserts);
    
    return conversationData.id;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
};

/**
 * Sends a message in a conversation
 */
export const sendConversationMessage = async (userId: string, conversationId: string, content: string, attachmentUrl?: string) => {
  try {
    // Send message
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        attachment_url: attachmentUrl || null
      });
    
    if (error) throw error;
    
    // Update conversation updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const enrichProfileWithRoles = (profile: any): Profile => {
  const enrichedProfile: Profile = {
    ...profile,
    roles: profile.roles || (profile.role ? [profile.role, 'student'] : ['student'])
  };
  
  // Ensure student is always included
  if (!enrichedProfile.roles.includes('student')) {
    enrichedProfile.roles.push('student');
  }
  
  return enrichedProfile;
};
