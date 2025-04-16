
import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message, Profile, ConversationParticipant } from '@/types/supabase';
import { enrichProfileWithRoles } from '@/utils/profileUtils';


export const fetchUserConversations = async (userId: string) => {
  try {
    if (!userId) {
      console.error('fetchUserConversations called without userId');
      return [];
    }
    console.log("Current User: ", userId)
    // Step 1: Get conversation IDs for the user
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
    console.log("[ConversationService] Step 1: Got conversation IDs:", conversationIds);
    
    // Step 2: Get ALL participants for these conversations who are NOT the current user
    const { data: otherParticipants, error: otherParticipantsError } = await supabase
      .from('conversation_participants')
      .select('*')
      .in('conversation_id', conversationIds)
      .neq('user_id', userId); // This ensures we only get OTHER participants, not the current user
    
    if (otherParticipantsError) {
      console.error('Error fetching other participants:', otherParticipantsError);
      throw otherParticipantsError;
    }
    
    console.log("[ConversationService] Step 2: Other participants sample:", otherParticipants[0], "\nTotal other participants count:", otherParticipants.length);
    // console.log("[ConversationService] Step 2: Total other participants count:", otherParticipants.length);
    
    // Step 3: Extract all unique OTHER user IDs
    const otherUserIds = [];
    otherParticipants.forEach(participant => {
      if (participant.user_id) {
        otherUserIds.push(participant.user_id);
      }
    });
    
    const uniqueOtherUserIds = [...new Set(otherUserIds)];
    console.log("[ConversationService] Step 3: Found unique OTHER user IDs:", uniqueOtherUserIds);
    
    // Step 4: Fetch profiles for all OTHER participants
    let profilesData = [];
    if (uniqueOtherUserIds.length > 0) {
      const { data, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', uniqueOtherUserIds);
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }
      
      profilesData = data || [];
    }
    
    console.log("[ConversationService] Step 4: Fetched profiles count:", profilesData.length);
    if (profilesData.length > 0) {
      console.log("Profile sample:", profilesData[0]);
    }
    
    // Step 5: Create a map for quick profile lookups
    const profilesMap = {};
    profilesData.forEach(profile => {
      profilesMap[profile.id] = {
        ...profile,
        roles: profile.roles || (profile.role ? [profile.role, 'student'] : ['student'])
      };
    });
    
    console.log("[ConversationService] Step 5: Created profiles map with keys:", Object.keys(profilesMap));
    
    // Step 6: Now fetch complete conversation data
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
          added_at
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
      .order('updated_at', { ascending: false });
    
    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError);
      throw conversationsError;
    }
    
    // Step 7: Enhance conversations with profile data and apply deduplication
    const seenParticipantCombinations = new Set();
    const enhancedConversations = [];
    
    for (const conversation of conversationsData) {
      // Get all participants who are NOT the current user
      const otherParticipants = (conversation.participants || [])
        .filter(p => p.user_id !== userId);
      
      // Create a unique key for this set of participants
      const participantKey = otherParticipants
        .map(p => p.user_id)
        .sort()
        .join(',');
      
      // Skip if we already have a conversation with these exact participants
      // (unless it's a group conversation, which we always include)
      if (!conversation.is_group && participantKey && seenParticipantCombinations.has(participantKey)) {
        continue;
      }
      
      // Mark this participant combination as seen
      if (participantKey) {
        seenParticipantCombinations.add(participantKey);
      }
      
      // Add profile data to each participant
      const enhancedParticipants = (conversation.participants || []).map(participant => {
        // Only look up profiles for other users (not the current user)
        const profile = participant.user_id !== userId 
          ? profilesMap[participant.user_id] 
          : null;
        
        return {
          ...participant,
          profile
        };
      });
      
      enhancedConversations.push({
        ...conversation,
        participants: enhancedParticipants,
        last_message: conversation.last_message && conversation.last_message.length > 0 
          ? conversation.last_message[0] 
          : null
      });
    }
    
    // Sort by most recent first
    return enhancedConversations.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at);
      const dateB = new Date(b.updated_at || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });
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
    
    // Get all conversations where both users are participants
    const { data: userParticipations, error: userError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);
    
    if (userError) {
      console.error("Error finding user conversations:", userError);
      throw userError;
    }
    
    if (!userParticipations || userParticipations.length === 0) {
      console.log("User has no conversations, creating new one");
      return await createNewConversationWithOtherUser(userId, otherUserId);
    }
    
    const userConversationIds = userParticipations.map(p => p.conversation_id);
    
    // Find conversations where the other user is also a participant
    const { data: otherUserParticipations, error: otherUserError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', userConversationIds);
    
    if (otherUserError) {
      console.error("Error finding other user's participation:", otherUserError);
      throw otherUserError;
    }
    
    if (!otherUserParticipations || otherUserParticipations.length === 0) {
      console.log("No shared conversations, creating new one");
      return await createNewConversationWithOtherUser(userId, otherUserId);
    }
    
    const sharedConversationIds = otherUserParticipations.map(p => p.conversation_id);
    
    // Get all shared conversations to check if they're direct (non-group) conversations
    const { data: sharedConversations, error: sharedConvError } = await supabase
      .from('conversations')
      .select('id, is_group, participants:conversation_participants(user_id)')
      .in('id', sharedConversationIds)
      .eq('is_group', false);
    
    if (sharedConvError) {
      console.error("Error finding shared conversations:", sharedConvError);
      throw sharedConvError;
    }
    
    // Find a direct conversation with exactly 2 participants (these two users)
    const directConversation = sharedConversations?.find(conv => {
      // Check if this conversation has exactly 2 participants
      return conv.participants && 
             conv.participants.length === 2 && 
             conv.participants.some(p => p.user_id === userId) &&
             conv.participants.some(p => p.user_id === otherUserId);
    });
    
    if (directConversation) {
      console.log("Found existing direct conversation:", directConversation.id);
      return directConversation.id;
    }
    
    console.log("No suitable existing conversation found, creating new one");
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
