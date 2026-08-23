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

  let action = 'unknown';
  try {
    const requestBody = await req.json();
    console.log('[messages-helper] Request payload:', JSON.stringify(requestBody, null, 2));

    action = requestBody.action;

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log('[messages-helper] Supabase admin client initialized.');

    // BEHAVIOR CHANGE (silent-failure audit / auth fail-open): this function
    // runs every query with the SERVICE ROLE key but previously trusted the
    // client-supplied userId/currentUserId/senderId — any authenticated user
    // could read or act on anyone else's conversations. We now resolve the
    // caller's identity from their JWT and require the acting-user parameter
    // to match it.
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller) {
      console.error('[messages-helper] Failed to authenticate caller:', callerError?.message);
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The parameter that identifies the acting user differs per action. The
    // guard used to be `if (actingUserId && ...)`, which meant a request that
    // simply omitted the field skipped the check entirely and fell through to a
    // service-role query with `undefined` as the user id. The acting user is now
    // always the caller — the body cannot influence it at all.
    const claimedUserId = requestBody.userId ?? requestBody.currentUserId ?? requestBody.senderId;
    if (claimedUserId && claimedUserId !== caller.id) {
      console.error(`[messages-helper] Caller ${caller.id} attempted to act as ${claimedUserId} (action: ${action})`);
      return new Response(JSON.stringify({ error: 'Forbidden: cannot act on behalf of another user' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const actingUserId = caller.id;

    console.log(`[messages-helper] Processing action: ${action}`);

    let result;
    switch (action) {
      case 'getConversations':
        result = await getConversations(supabaseAdmin, actingUserId);
        break;
      case 'getArchivedConversations':
        result = await getArchivedConversations(supabaseAdmin, actingUserId);
        break;
      case 'getDeletedConversations':
        result = await getDeletedConversations(supabaseAdmin, actingUserId);
        break;
      case 'createConversation':
        result = await createConversation(supabaseAdmin, requestBody.subject, requestBody.recipientIds, actingUserId);
        break;
      case 'checkOneOnOneConversation':
        result = await checkOneOnOneConversation(supabaseAdmin, actingUserId, requestBody.otherUserId);
        break;
      case 'sendMessage':
        result = await sendMessage(supabaseAdmin, actingUserId, requestBody.conversationId, requestBody.content, requestBody.attachmentUrl);
        break;
      case 'archiveConversation':
        result = await archiveConversation(supabaseAdmin, requestBody.conversationId, actingUserId);
        break;
      case 'unarchiveConversation':
        result = await unarchiveConversation(supabaseAdmin, requestBody.conversationId, actingUserId);
        break;
      case 'deleteConversation':
        result = await deleteConversation(supabaseAdmin, requestBody.conversationId, actingUserId);
        break;
      case 'restoreConversation':
        result = await restoreConversation(supabaseAdmin, requestBody.conversationId, actingUserId);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`[messages-helper] Action ${action} completed successfully. Returning result.`);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[messages-helper] Error in action '${action}':`, message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Returns true if a stored subject is missing or was generated with null values
function isBlankSubject(subject: string | null | undefined): boolean {
  if (!subject || subject.trim() === '') return true;
  // Catches "null null", "null", "null  null", etc. left by old subject-generation bugs
  return /^(null\s*)+$/i.test(subject.trim());
}

async function getConversations(supabaseAdmin: any, userId: string) {
  console.log(`[messages-helper/getConversations] Starting for user: ${userId}`);

  const { data: participantData, error: participantError } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId)
    .neq('archived', true)
    .is('deleted_at', null);

  if (participantError) {
    console.error('[messages-helper/getConversations] Error fetching conversation IDs:', participantError);
    throw new Error(`Failed to fetch conversation IDs: ${participantError.message}`);
  }

  const activeConversationIds = (participantData || []).map((p: any) => p.conversation_id);
  console.log(`[messages-helper/getConversations] Found ${activeConversationIds.length} active conversations.`);

  if (activeConversationIds.length === 0) {
    return { conversations: [] };
  }

  console.log(`[messages-helper/getConversations] Fetching details for conversation IDs:`, activeConversationIds);

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
          avatar_url
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
    .in('id', activeConversationIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false, foreignTable: 'messages' })
    .limit(1, { foreignTable: 'messages' });

  if (conversationError) {
    throw new Error(`Failed to fetch conversation details: ${conversationError.message}`);
  }

  // Process conversations to include latest message and generate subject if missing
  const processedConversations = (conversationData || []).map((conv: any) => {
    let subject = conv.subject;
    
    // Generate subject for conversations without one
    if (isBlankSubject(subject)) {
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

  const archivedConversationIds = participantData.map((p: { conversation_id: string }) => p.conversation_id);
  console.log(`[messages-helper/getArchivedConversations] Fetching details for conversation IDs:`, archivedConversationIds);

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
          avatar_url
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
    .in('id', archivedConversationIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false, foreignTable: 'messages' })
    .limit(1, { foreignTable: 'messages' });

  if (conversationError) {
    throw new Error(`Failed to fetch archived conversation details: ${conversationError.message}`);
  }

  // Process conversations with proper subject generation
  const processedConversations = (conversationData || []).map((conv: any) => {
    let subject = conv.subject;
    
    if (isBlankSubject(subject)) {
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

  const conversationIds = participantData.map((p: { conversation_id: string }) => p.conversation_id);
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
          avatar_url
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
  const processedConversations = (conversationData || []).map((conv: any) => {
    let subject = conv.subject;
    
    if (isBlankSubject(subject)) {
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
  //
  // Every conversation must belong to a course.
  //
  // `conversations_require_course` is a BEFORE INSERT trigger that raises when
  // course_id is null, and `enforce_conversation_participant_in_course` rejects
  // any participant who is not enrolled in (or teaching, or an admin of) that
  // course. This function used to insert without a course_id at all, so once
  // those triggers went live EVERY attempt to start a conversation failed with a
  // raw Postgres exception, and the New Conversation dialog was simply broken.
  //
  // So the course is derived rather than asked for: pick one that the creator
  // AND every recipient already belong to. That satisfies both triggers by
  // construction, and it keeps the dialog free of a course picker for a value
  // the server can work out. When there is no such course the conversation is
  // genuinely not permissible, and saying so plainly beats a database error.
  const everyone = [currentUserId, ...recipientIds];
  const { data: sharedCourses, error: sharedError } = await supabaseAdmin
    .rpc('courses_shared_by_users', { p_user_ids: everyone });

  if (sharedError) {
    throw new Error(`Failed to resolve a shared course: ${sharedError.message}`);
  }

  const courseId = sharedCourses?.[0]?.course_id ?? null;
  if (!courseId) {
    throw new Error(
      'You can only message people you share a course with. Enrol in a common course first.',
    );
  }

  const { data: conversationData, error: conversationError } = await supabaseAdmin
    .from('conversations')
    .insert({
      subject: finalSubject,
      is_group: isGroup,
      created_by: currentUserId,
      course_id: courseId
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

  // Every query here runs with the service role, which bypasses RLS, so the
  // participant check the database would normally enforce has to happen here.
  // Without it a signed-in user could post into any conversation just by
  // guessing its id — the same hole the self-referential WITH CHECK left open
  // on the direct table path.
  const { data: participant, error: participantError } = await supabaseAdmin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', senderId)
    .maybeSingle();

  if (participantError) {
    throw new Error(`Failed to verify conversation membership: ${participantError.message}`);
  }

  if (!participant) {
    console.error(`[messages-helper/sendMessage] ${senderId} is not a participant in ${conversationId}`);
    throw new Error('Not a participant in this conversation');
  }

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
