
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log(`[messages-helper] Received request: ${req.method} ${req.url}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[messages-helper] Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log('[messages-helper] Request payload:', JSON.stringify(requestBody, null, 2));

    const { action } = requestBody;

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log('[messages-helper] Supabase admin client initialized.');

    console.log(`[messages-helper] Processing action: ${action}`);

    let result;
    switch (action) {
      case 'getConversations':
        result = await getConversations(supabaseAdmin, requestBody.userId);
        break;
      case 'getArchivedConversations':
        result = await getArchivedConversations(supabaseAdmin, requestBody.userId);
        break;
      case 'getDeletedConversations':
        result = await getDeletedConversations(supabaseAdmin, requestBody.userId);
        break;
      case 'createConversation':
        result = await createConversation(supabaseAdmin, requestBody.subject, requestBody.recipientIds, requestBody.currentUserId);
        break;
      case 'checkOneOnOneConversation':
        result = await checkOneOnOneConversation(supabaseAdmin, requestBody.currentUserId, requestBody.otherUserId);
        break;
      case 'sendMessage':
        result = await sendMessage(supabaseAdmin, requestBody.senderId, requestBody.conversationId, requestBody.content, requestBody.attachmentUrl);
        break;
      case 'archiveConversation':
        result = await archiveConversation(supabaseAdmin, requestBody.conversationId, requestBody.userId);
        break;
      case 'unarchiveConversation':
        result = await unarchiveConversation(supabaseAdmin, requestBody.conversationId, requestBody.userId);
        break;
      case 'deleteConversation':
        result = await deleteConversation(supabaseAdmin, requestBody.conversationId, requestBody.userId);
        break;
      case 'restoreConversation':
        result = await restoreConversation(supabaseAdmin, requestBody.conversationId, requestBody.userId);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`[messages-helper] Action ${action} completed successfully. Returning result.`);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[messages-helper] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getConversations(supabaseAdmin: any, userId: string) {
  console.log(`[messages-helper/getConversations] Starting for user: ${userId}`);
  
  // Get all conversation participants for this user where they're not archived or deleted
  const { data: participantData, error: participantError } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId)
    .eq('archived', false)
    .is('deleted_at', null);

  if (participantError) {
    throw new Error(`Failed to fetch participant records: ${participantError.message}`);
  }

  console.log(`[messages-helper/getConversations] Found ${participantData?.length || 0} active participation records.`);

  if (!participantData || participantData.length === 0) {
    return { conversations: [] };
  }

  const conversationIds = participantData.map(p => p.conversation_id);
  console.log(`[messages-helper/getConversations] Fetching details for conversation IDs:`, conversationIds);

  // Fetch conversation details with participants and latest messages
  const { data: conversationData, error: conversationError } = await supabaseAdmin
    .from('conversations')
    .select(`
      id,
      subject,
      is_group,
      archived,
      created_at,
      updated_at,
      created_by,
      deleted_at,
      participants:conversation_participants(
        user_id,
        added_at,
        archived,
        deleted_at,
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
        content,
        created_at,
        read,
        sender_id
      )
    `)
    .in('id', conversationIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false, foreignTable: 'messages' })
    .limit(1, { foreignTable: 'messages' });

  if (conversationError) {
    throw new Error(`Failed to fetch conversation details: ${conversationError.message}`);
  }

  // Process conversations to include latest message and generate subject if missing
  const processedConversations = (conversationData || []).map(conv => {
    let subject = conv.subject;
    
    // Generate subject for conversations without one
    if (!subject || subject.trim() === '') {
      if (conv.is_group) {
        const participantNames = conv.participants
          ?.filter((p: any) => p.profile && p.profile.first_name && p.user_id !== userId)
          ?.map((p: any) => `${p.profile.first_name} ${p.profile.last_name || ''}`.trim())
          ?.slice(0, 3);
        subject = participantNames?.length > 0 ? participantNames.join(', ') + (conv.participants?.length > 3 ? '...' : '') : 'Group Conversation';
      } else {
        // For one-on-one, find the other participant
        const otherParticipant = conv.participants?.find((p: any) => p.user_id !== userId);
        if (otherParticipant?.profile) {
          subject = `${otherParticipant.profile.first_name || ''} ${otherParticipant.profile.last_name || ''}`.trim() || 'Conversation';
        } else {
          subject = 'Conversation';
        }
      }
    }

    return {
      ...conv,
      subject,
      last_message: conv.last_message?.[0] || null
    };
  });

  console.log(`[messages-helper/getConversations] Retrieved ${processedConversations.length} conversations.`);
  return { conversations: processedConversations };
}

async function getArchivedConversations(supabaseAdmin: any, userId: string) {
  console.log(`[messages-helper/getArchivedConversations] Starting for user: ${userId}`);
  
  // Get conversation participants for this user that are archived but not deleted
  const { data: participantData, error: participantError } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId)
    .eq('archived', true)
    .is('deleted_at', null);

  if (participantError) {
    throw new Error(`Failed to fetch archived participant records: ${participantError.message}`);
  }

  console.log(`[messages-helper/getArchivedConversations] Found ${participantData?.length || 0} archived participation records.`);

  if (!participantData || participantData.length === 0) {
    return { conversations: [] };
  }

  const conversationIds = participantData.map(p => p.conversation_id);
  console.log(`[messages-helper/getArchivedConversations] Fetching details for conversation IDs:`, conversationIds);

  // Fetch conversation details
  const { data: conversationData, error: conversationError } = await supabaseAdmin
    .from('conversations')
    .select(`
      id,
      subject,
      is_group,
      archived,
      created_at,
      updated_at,
      created_by,
      deleted_at,
      participants:conversation_participants(
        user_id,
        added_at,
        archived,
        deleted_at,
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
        content,
        created_at,
        read,
        sender_id
      )
    `)
    .in('id', conversationIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false, foreignTable: 'messages' })
    .limit(1, { foreignTable: 'messages' });

  if (conversationError) {
    throw new Error(`Failed to fetch archived conversation details: ${conversationError.message}`);
  }

  // Process conversations with proper subject generation
  const processedConversations = (conversationData || []).map(conv => {
    let subject = conv.subject;
    
    if (!subject || subject.trim() === '') {
      if (conv.is_group) {
        const participantNames = conv.participants
          ?.filter((p: any) => p.profile && p.profile.first_name && p.user_id !== userId)
          ?.map((p: any) => `${p.profile.first_name} ${p.profile.last_name || ''}`.trim())
          ?.slice(0, 3);
        subject = participantNames?.length > 0 ? participantNames.join(', ') + (conv.participants?.length > 3 ? '...' : '') : 'Group Conversation';
      } else {
        const otherParticipant = conv.participants?.find((p: any) => p.user_id !== userId);
        if (otherParticipant?.profile) {
          subject = `${otherParticipant.profile.first_name || ''} ${otherParticipant.profile.last_name || ''}`.trim() || 'Conversation';
        } else {
          subject = 'Conversation';
        }
      }
    }

    return {
      ...conv,
      subject,
      last_message: conv.last_message?.[0] || null
    };
  });

  console.log(`[messages-helper/getArchivedConversations] Retrieved ${processedConversations.length} archived conversations.`);
  return { conversations: processedConversations };
}

async function getDeletedConversations(supabaseAdmin: any, userId: string) {
  console.log(`[messages-helper/getDeletedConversations] Starting for user: ${userId}`);
  
  // Get conversation participants for this user that are deleted
  const { data: participantData, error: participantError } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null);

  if (participantError) {
    throw new Error(`Failed to fetch deleted participant records: ${participantError.message}`);
  }

  console.log(`[messages-helper/getDeletedConversations] Found ${participantData?.length || 0} deleted participation records.`);

  if (!participantData || participantData.length === 0) {
    return { conversations: [] };
  }

  const conversationIds = participantData.map(p => p.conversation_id);
  console.log(`[messages-helper/getDeletedConversations] Fetching details for conversation IDs:`, conversationIds);

  // Fetch conversation details
  const { data: conversationData, error: conversationError } = await supabaseAdmin
    .from('conversations')
    .select(`
      id,
      subject,
      is_group,
      archived,
      created_at,
      updated_at,
      created_by,
      deleted_at,
      participants:conversation_participants(
        user_id,
        added_at,
        archived,
        deleted_at,
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
        content,
        created_at,
        read,
        sender_id
      )
    `)
    .in('id', conversationIds)
    .order('created_at', { ascending: false, foreignTable: 'messages' })
    .limit(1, { foreignTable: 'messages' });

  if (conversationError) {
    throw new Error(`Failed to fetch deleted conversation details: ${conversationError.message}`);
  }

  // Process conversations with proper subject generation
  const processedConversations = (conversationData || []).map(conv => {
    let subject = conv.subject;
    
    if (!subject || subject.trim() === '') {
      if (conv.is_group) {
        const participantNames = conv.participants
          ?.filter((p: any) => p.profile && p.profile.first_name && p.user_id !== userId)
          ?.map((p: any) => `${p.profile.first_name} ${p.profile.last_name || ''}`.trim())
          ?.slice(0, 3);
        subject = participantNames?.length > 0 ? participantNames.join(', ') + (conv.participants?.length > 3 ? '...' : '') : 'Group Conversation';
      } else {
        const otherParticipant = conv.participants?.find((p: any) => p.user_id !== userId);
        if (otherParticipant?.profile) {
          subject = `${otherParticipant.profile.first_name || ''} ${otherParticipant.profile.last_name || ''}`.trim() || 'Conversation';
        } else {
          subject = 'Conversation';
        }
      }
    }

    return {
      ...conv,
      subject,
      last_message: conv.last_message?.[0] || null
    };
  });

  console.log(`[messages-helper/getDeletedConversations] Retrieved ${processedConversations.length} deleted conversations.`);
  return { conversations: processedConversations };
}

async function createConversation(supabaseAdmin: any, subject: string, recipientIds: string[], currentUserId: string) {
  console.log(`[messages-helper/createConversation] Creating conversation with ${recipientIds.length} recipients for user ${currentUserId}`);
  
  const isGroup = recipientIds.length > 1;
  let finalSubject = subject;

  // If no subject provided, generate one based on participants
  if (!finalSubject || finalSubject.trim() === '') {
    if (isGroup) {
      // For groups, get participant names
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .in('id', recipientIds);
      
      if (profiles && profiles.length > 0) {
        const names = profiles.map((p: any) => `${p.first_name || ''} ${p.last_name || ''}`.trim()).slice(0, 3);
        finalSubject = names.join(', ') + (recipientIds.length > 3 ? '...' : '');
      } else {
        finalSubject = 'Group Conversation';
      }
    } else {
      // For one-on-one, use the other participant's name
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', recipientIds[0])
        .single();
      
      if (profile) {
        finalSubject = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Conversation';
      } else {
        finalSubject = 'Conversation';
      }
    }
  }

  // Create the conversation
  const { data: conversationData, error: conversationError } = await supabaseAdmin
    .from('conversations')
    .insert({
      subject: finalSubject,
      is_group: isGroup,
      created_by: currentUserId
    })
    .select('id')
    .single();

  if (conversationError) {
    throw new Error(`Failed to create conversation: ${conversationError.message}`);
  }

  const conversationId = conversationData.id;

  // Add participants (including the creator)
  const allParticipants = [currentUserId, ...recipientIds];
  const participantInserts = allParticipants.map(userId => ({
    conversation_id: conversationId,
    user_id: userId
  }));

  const { error: participantError } = await supabaseAdmin
    .from('conversation_participants')
    .insert(participantInserts);

  if (participantError) {
    throw new Error(`Failed to add participants: ${participantError.message}`);
  }

  console.log(`[messages-helper/createConversation] Successfully created conversation: ${conversationId}`);
  return { conversationId };
}

async function checkOneOnOneConversation(supabaseAdmin: any, currentUserId: string, otherUserId: string) {
  console.log(`[messages-helper/checkOneOnOneConversation] Checking between ${currentUserId} and ${otherUserId}`);
  
  // Use the database function to find existing one-on-one conversation
  const { data, error } = await supabaseAdmin.rpc('find_one_on_one_conversation', {
    user1_id: currentUserId,
    user2_id: otherUserId
  });

  if (error) {
    throw new Error(`Failed to check for existing conversation: ${error.message}`);
  }

  if (data && data.length > 0) {
    const conversationId = data[0].conversation_id;
    console.log(`[messages-helper/checkOneOnOneConversation] Found one-on-one conversation: ${conversationId}`);
    return { conversationId };
  }

  console.log(`[messages-helper/checkOneOnOneConversation] No existing conversation found`);
  return { conversationId: null };
}

async function sendMessage(supabaseAdmin: any, senderId: string, conversationId: string, content: string, attachmentUrl?: string) {
  console.log(`[messages-helper/sendMessage] Sending message in conversation: ${conversationId}`);
  
  // Insert the message
  const { error: messageError } = await supabaseAdmin
    .from('messages')
    .insert({
      sender_id: senderId,
      conversation_id: conversationId,
      content,
      attachment_url: attachmentUrl
    });

  if (messageError) {
    throw new Error(`Failed to send message: ${messageError.message}`);
  }

  // Update conversation's updated_at timestamp
  const { error: updateError } = await supabaseAdmin
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (updateError) {
    console.warn(`[messages-helper/sendMessage] Failed to update conversation timestamp: ${updateError.message}`);
  }

  console.log(`[messages-helper/sendMessage] Message sent successfully`);
  return { success: true };
}

async function archiveConversation(supabaseAdmin: any, conversationId: string, userId: string) {
  console.log(`[messages-helper/archiveConversation] Archiving conversation: ${conversationId} for user: ${userId}`);
  
  const { error } = await supabaseAdmin
    .from('conversation_participants')
    .update({ archived: true })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to archive conversation: ${error.message}`);
  }

  console.log(`[messages-helper/archiveConversation] Conversation archived successfully`);
  return { success: true };
}

async function unarchiveConversation(supabaseAdmin: any, conversationId: string, userId: string) {
  console.log(`[messages-helper/unarchiveConversation] Unarchiving conversation: ${conversationId} for user: ${userId}`);
  
  const { error } = await supabaseAdmin
    .from('conversation_participants')
    .update({ archived: false })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to unarchive conversation: ${error.message}`);
  }

  console.log(`[messages-helper/unarchiveConversation] Conversation unarchived successfully`);
  return { success: true };
}

async function deleteConversation(supabaseAdmin: any, conversationId: string, userId: string) {
  console.log(`[messages-helper/deleteConversation] Deleting conversation: ${conversationId} for user: ${userId}`);
  
  const { error } = await supabaseAdmin
    .from('conversation_participants')
    .update({ deleted_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete conversation: ${error.message}`);
  }

  console.log(`[messages-helper/deleteConversation] Conversation deleted successfully`);
  return { success: true };
}

async function restoreConversation(supabaseAdmin: any, conversationId: string, userId: string) {
  console.log(`[messages-helper/restoreConversation] Restoring conversation: ${conversationId} for user: ${userId}`);
  
  const { error } = await supabaseAdmin
    .from('conversation_participants')
    .update({ 
      deleted_at: null,
      archived: false
    })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to restore conversation: ${error.message}`);
  }

  console.log(`[messages-helper/restoreConversation] Conversation restored successfully`);
  return { success: true };
}
