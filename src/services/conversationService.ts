
import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message, Profile, ConversationParticipant } from '@/types/supabase';
import { enrichProfileWithRoles } from '@/utils/profileUtils';

/**
 * Fetches all conversations for a user
 */
// export const fetchUserConversations = async (userId: string) => {
//   try {
//     if (!userId) {
//       console.error('fetchUserConversations called without userId');
//       return [];
//     }
    
//     // First, get conversation IDs for the user
//     const { data: participantData, error: participantError } = await supabase
//       .from('conversation_participants')
//       .select('conversation_id')
//       .eq('user_id', userId);
    
//     if (participantError) {
//       console.error('Error fetching participant data:', participantError);
//       throw participantError;
//     }
    
//     if (!participantData || participantData.length === 0) {
//       return [];
//     }
    
//     const conversationIds = participantData.map(p => p.conversation_id);
    
//     // Fetch conversations with participants and last message
//     const { data: conversationsData, error: conversationsError } = await supabase
//       .from('conversations')
//       .select(`
//         id,
//         subject,
//         is_group,
//         created_by,
//         updated_at,
//         created_at,
//         participants:conversation_participants(
//           id,
//           user_id,
//           conversation_id,
//           added_at,
//           profile:profiles(
//             id,
//             first_name,
//             last_name,
//             avatar_url,
//             role
//           )
//         ),
//         last_message:messages(
//           id,
//           sender_id,
//           content,
//           read,
//           created_at
//         )
//         `)
//       .in('id', conversationIds)
//       .order('updated_at', { ascending: false })
//       .limit(20);
    
//     if (conversationsError) {
//       console.error('Error fetching conversations:', conversationsError);
//       throw conversationsError;
//     }
    
//     // Transform the data to match our expected types
//     return conversationsData.map(conversation => ({
//       ...conversation,
//       participants: conversation.participants.map(p => ({
//         ...p,
//         profile: p.profile ? enrichProfileWithRoles(p.profile) : undefined
//       })),
//       last_message: conversation.last_message[0] || null
//     })) as Conversation[];
//   } catch (error) {
//     console.error('Error in fetchUserConversations:', error);
//     throw error;
//   }
// };


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
    console.log("Fetching conversations with IDs:", conversationIds);
    
    // Now fetch ALL participants for these conversations, not just the current user
    const { data: allParticipantsData, error: allParticipantsError } = await supabase
      .from('conversation_participants')
      .select('user_id, conversation_id')
      .in('conversation_id', conversationIds);
      
    if (allParticipantsError) {
      console.error('Error fetching all participants:', allParticipantsError);
      throw allParticipantsError;
    }
    
    // Extract all unique user IDs from all participants
    const allUserIds = allParticipantsData.map(p => p.user_id);
    const uniqueUserIds = [...new Set(allUserIds)];
    console.log("All unique participant user IDs:", uniqueUserIds);
    
    // Fetch profiles for all participants
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', uniqueUserIds);
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }
    
    console.log("Fetched profiles:", profilesData);
    
    // Create a profile lookup map
    const profilesMap = {};
    for (const profile of profilesData) {
      profilesMap[profile.id] = enrichProfileWithRoles(profile);
    }
    
    // Now fetch the complete conversation data
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
    
    // Enhance the conversations with profile data
    const enhancedConversations = conversationsData.map(conversation => {
      const enhancedParticipants = conversation.participants.map(participant => {
        return {
          ...participant,
          profile: profilesMap[participant.user_id] || null
        };
      });
      
      return {
        ...conversation,
        participants: enhancedParticipants,
        last_message: conversation.last_message && conversation.last_message.length > 0 
          ? conversation.last_message[0] 
          : null
      };
    });
    
    return enhancedConversations;
  } catch (error) {
    console.error('Error in fetchUserConversations:', error);
    throw error;
  }
};


// export const fetchUserConversations = async (userId: string) => {
//   try {
//     if (!userId) {
//       console.error('fetchUserConversations called without userId');
//       return [];
//     }
    
//     // First, get conversation IDs for the user
//     const { data: participantData, error: participantError } = await supabase
//       .from('conversation_participants')
//       .select('conversation_id')
//       .eq('user_id', userId);
    
//     if (participantError) {
//       console.error('Error fetching participant data:', participantError);
//       throw participantError;
//     }
    
//     if (!participantData || participantData.length === 0) {
//       return [];
//     }
    
//     const conversationIds = participantData.map(p => p.conversation_id);
//     console.log("Fetching conversations with IDs:", conversationIds);
    
//     // Fetch conversations with participants but WITHOUT nested profiles
//     const { data: conversationsData, error: conversationsError } = await supabase
//       .from('conversations')
//       .select(`
//         id,
//         subject,
//         is_group,
//         created_by,
//         updated_at,
//         created_at,
//         participants:conversation_participants(
//           id,
//           user_id,
//           conversation_id,
//           added_at
//         ),
//         last_message:messages(
//           id,
//           sender_id,
//           content,
//           read,
//           created_at
//         )
//       `)
//       .in('id', conversationIds)
//       .order('updated_at', { ascending: false });
    
//     if (conversationsError) {
//       console.error('Error fetching conversations:', conversationsError);
//       throw conversationsError;
//     }
    
//     // Collect ALL user IDs from participants for profile fetching
//     const participantUserIds = new Set();
//     for (const conversation of conversationsData) {
//       if (conversation.participants) {
//         for (const participant of conversation.participants) {
//           if (participant.user_id) {
//             participantUserIds.add(participant.user_id);
//           }
//         }
//       }
//     }
    
//     // Convert Set to Array to use with .in() query
//     const userIdsArray = Array.from(participantUserIds);
//     console.log("Fetching profiles for user IDs:", userIdsArray);
    
//     if (userIdsArray.length === 0) {
//       console.warn("No participant user IDs found for profile fetching");
//       return conversationsData;
//     }
    
//     // Fetch all user profiles in a single query
//     const { data: profilesData, error: profilesError } = await supabase
//       .from('profiles')
//       .select('*')
//       .in('id', userIdsArray);
    
//     if (profilesError) {
//       console.error('Error fetching profiles:', profilesError);
//       throw profilesError;
//     }
    
//     console.log("Fetched profiles:", profilesData);
    
//     // Create a map of user_id -> profile for faster lookups
//     const profilesMap = {};
//     for (const profile of profilesData) {
//       profilesMap[profile.id] = enrichProfileWithRoles(profile);
//     }
    
//     console.log("Profiles map:", profilesMap);
    
//     // Enhance participants with their profiles
//     const enhancedConversations = conversationsData.map(conversation => {
//       const enhancedParticipants = conversation.participants.map(participant => ({
//         ...participant,
//         profile: profilesMap[participant.user_id] || null
//       }));
      
//       return {
//         ...conversation,
//         participants: enhancedParticipants,
//         last_message: conversation.last_message && conversation.last_message.length > 0 
//           ? conversation.last_message[0] 
//           : null
//       };
//     });
    
//     return enhancedConversations;
//   } catch (error) {
//     console.error('Error in fetchUserConversations:', error);
//     throw error;
//   }
// };

// export const fetchUserConversations = async (userId: string) => {
//   try {
//     if (!userId) {
//       console.error('fetchUserConversations called without userId');
//       return [];
//     }
    
//     // First, get conversation IDs for the user
//     const { data: participantData, error: participantError } = await supabase
//       .from('conversation_participants')
//       .select('conversation_id')
//       .eq('user_id', userId);
    
//     if (participantError) {
//       console.error('Error fetching participant data:', participantError);
//       throw participantError;
//     }
    
//     if (!participantData || participantData.length === 0) {
//       return [];
//     }
    
//     const conversationIds = participantData.map(p => p.conversation_id);
//     console.log("Fetching conversations with IDs:", conversationIds);
    
//     // Fetch conversations with participants and last message
//     const { data: conversationsData, error: conversationsError } = await supabase
//       .from('conversations')
//       .select(`
//         id,
//         subject,
//         is_group,
//         created_by,
//         updated_at,
//         created_at,
//         participants:conversation_participants(
//           id,
//           user_id,
//           conversation_id,
//           added_at
//         ),
//         last_message:messages(
//           id,
//           sender_id,
//           content,
//           read,
//           created_at
//         )
//       `)
//       .in('id', conversationIds)
//       .order('updated_at', { ascending: false });
    
//     if (conversationsError) {
//       console.error('Error fetching conversations:', conversationsError);
//       throw conversationsError;
//     }
    
//     // Now fetch profiles for all participants separately
//     const allParticipantUserIds = [];
//     for (const conversation of conversationsData) {
//       if (conversation.participants) {
//         for (const participant of conversation.participants) {
//           if (participant.user_id) {
//             allParticipantUserIds.push(participant.user_id);
//           }
//         }
//       }
//     }
    
//     // Remove duplicates
//     const uniqueUserIds = [...new Set(allParticipantUserIds)];
//     console.log("Fetching profiles for user IDs:", uniqueUserIds);
    
//     const { data: profilesData, error: profilesError } = await supabase
//       .from('profiles')
//       .select('*')
//       .in('id', uniqueUserIds);
    
//     if (profilesError) {
//       console.error('Error fetching profiles:', profilesError);
//       throw profilesError;
//     }
    
//     // Create a map of user_id -> profile for faster lookups
//     const profilesMap = {};
//     for (const profile of profilesData) {
//       profilesMap[profile.id] = enrichProfileWithRoles(profile);
//     }
    
//     console.log("Profiles map:", profilesMap);
    
//     // Now enhance each conversation with the profiles
//     const enhancedConversations = conversationsData.map(conversation => {
//       const enhancedParticipants = conversation.participants.map(participant => ({
//         ...participant,
//         profile: profilesMap[participant.user_id] || null
//       }));
      
//       return {
//         ...conversation,
//         participants: enhancedParticipants,
//         last_message: conversation.last_message[0] || null
//       };
//     });
    
//     return enhancedConversations;
//   } catch (error) {
//     console.error('Error in fetchUserConversations:', error);
//     throw error;
//   }
// };
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
