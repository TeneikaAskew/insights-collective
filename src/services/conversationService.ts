
import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message, Profile, ConversationParticipant } from '@/types/supabase';

/**
 * Fetches all conversations for a user
 */
export const fetchUserConversations = async (userId: string) => {
  try {
    if (!userId) {
      console.error('fetchUserConversations called without userId');
      return [];
    }
    
    // Get all conversations where the user is a participant
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
      
    if (conversationsError) {
      console.error('Error fetching conversations data:', conversationsError);
      throw conversationsError;
    }
    
    if (!conversationsData || conversationsData.length === 0) {
      return [];
    }
    
    // Process each conversation individually to avoid relation errors
    const enrichedConversations: Conversation[] = [];
    
    for (const conversation of conversationsData) {
      try {
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
          
        if (participantsError) {
          console.error(`Error fetching participants for conversation ${conversation.id}:`, participantsError);
          continue; // Skip this conversation but continue processing others
        }
        
        // Get profiles for each participant
        const participantsWithProfiles: ConversationParticipant[] = [];
        
        for (const participant of participantsData || []) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', participant.user_id)
            .single();
            
          if (!profileError && profileData) {
            participantsWithProfiles.push({
              ...participant,
              profile: profileData
            });
          } else {
            // Still add the participant without profile information
            participantsWithProfiles.push({
              ...participant,
              profile: undefined
            });
          }
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
          .limit(1);
          
        let lastMessage: Message | undefined = undefined;
        
        if (!messageError && messageData && messageData.length > 0) {
          lastMessage = messageData[0] as Message;
        }
        
        enrichedConversations.push({
          ...conversation,
          participants: participantsWithProfiles,
          last_message: lastMessage
        });
      } catch (error) {
        console.error(`Error processing conversation ${conversation.id}:`, error);
        // Continue with next conversation
      }
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
    if (!userId) {
      throw new Error('User ID is required');
    }
    
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
    
    if (conversationError) {
      console.error('Error creating conversation:', conversationError);
      throw conversationError;
    }
    
    if (!conversationData) {
      throw new Error('Failed to create conversation');
    }
    
    // Add current user as participant
    const { error: participantError } = await supabase
      .from('conversation_participants')
      .insert({
        conversation_id: conversationData.id,
        user_id: userId
      });
      
    if (participantError) {
      console.error('Error adding current user as participant:', participantError);
      throw participantError;
    }
    
    // Add all recipients as participants
    const participantInserts = recipientIds.map(recipientId => ({
      conversation_id: conversationData.id,
      user_id: recipientId
    }));
    
    if (participantInserts.length > 0) {
      const { error: recipientsError } = await supabase
        .from('conversation_participants')
        .insert(participantInserts);
        
      if (recipientsError) {
        console.error('Error adding recipients as participants:', recipientsError);
        throw recipientsError;
      }
    }
    
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
    if (!userId || !conversationId) {
      throw new Error('User ID and Conversation ID are required');
    }
    
    // Send message
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        attachment_url: attachmentUrl || null
      });
    
    if (error) {
      console.error('Error sending message:', error);
      throw error;
    }
    
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
  if (!profile) return null as any;
  
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
