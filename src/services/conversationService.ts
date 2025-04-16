
import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message, Profile, ConversationParticipant } from '@/types/supabase';
import { enrichProfileWithRoles } from '@/utils/profileUtils';

export const archiveConversation = async (id: string, archive: boolean = true) => {
  const { error } = await supabase
    .from('conversations')
    .update({ archived: archive })
    .eq('id', id);

  if (error) throw error;
};

export const deleteConversation = async (id: string) => {
  const { error } = await supabase
    .from('conversations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
};

export const fetchUserConversations = async (userId: string) => {
  try {
    if (!userId) {
      console.error('fetchUserConversations called without userId');
      return [];
    }

    const { data: participantData, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (participantError) throw participantError;
    if (!participantData?.length) return [];

    const conversationIds = participantData.map(p => p.conversation_id);

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
      .order('updated_at', { ascending: false })
      .limit(20);

    if (conversationsError) throw conversationsError;

    const processedData = conversationsData.map(conversation => ({
      ...conversation,
      participants: conversation.participants.map(p => ({
        ...p,
        profile: p.profile ? enrichProfileWithRoles(p.profile) : undefined
      })),
      last_message: conversation.last_message[0] || null
    }));

    // Cast to Conversation[] type after proper transformation
    return processedData as unknown as Conversation[];
  } catch (error) {
    console.error('Error in fetchUserConversations:', error);
    throw error;
  }
};

export const createNewConversation = async (subject: string, recipientIds: string[]) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    const { data: conversationData, error: conversationError } = await supabase
      .from('conversations')
      .insert({
        subject,
        is_group: recipientIds.length > 1,
        created_by: user.id
      })
      .select('id')
      .single();

    if (conversationError) throw conversationError;
    if (!conversationData) throw new Error('Failed to create conversation');

    const participantInserts = [
      { conversation_id: conversationData.id, user_id: user.id },
      ...recipientIds.map(recipientId => ({ conversation_id: conversationData.id, user_id: recipientId }))
    ];

    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .insert(participantInserts);

    if (participantsError) throw participantsError;

    return conversationData.id;
  } catch (error) {
    console.error('[createNewConversation] Error:', error);
    throw error;
  }
};

export const sendConversationMessage = async (userId: string, conversationId: string, content: string, attachmentUrl?: string) => {
  try {
    if (!userId || !conversationId || !content.trim()) throw new Error('Required fields missing');

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

    if (error) throw error;

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

export const findExistingOneOnOneConversation = async (userId: string, otherUserId: string) => {
  try {
    const { data: userConversations, error: userError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (userError) throw userError;
    if (!userConversations?.length) return null;

    const conversationIds = userConversations.map(c => c.conversation_id);

    const { data: sharedConversations, error: sharedError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', conversationIds);

    if (sharedError) throw sharedError;
    if (!sharedConversations?.length) return null;

    const sharedIds = sharedConversations.map(c => c.conversation_id);

    const { data: nonGroupConvs, error: groupError } = await supabase
      .from('conversations')
      .select('id')
      .in('id', sharedIds)
      .eq('is_group', false);

    if (groupError) throw groupError;
    return nonGroupConvs?.[0]?.id || null;
  } catch (error) {
    console.error('Error finding existing conversation:', error);
    return null;
  }
};

export const getOrCreateOneOnOneConversation = async (userId: string, otherUserId: string) => {
  try {
    const existingConversationId = await findExistingOneOnOneConversation(userId, otherUserId);
    if (existingConversationId) return existingConversationId;

    const { data: otherUser, error: userError } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', otherUserId)
      .single();

    if (userError) throw userError;

    const subject = otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'New conversation';
    return await createNewConversation(subject, [otherUserId]);
  } catch (error) {
    console.error('Error in getOrCreateOneOnOneConversation:', error);
    throw error;
  }
};
