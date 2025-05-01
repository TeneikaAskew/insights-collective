// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to fetch conversation details including participants and last message
// Removed as it wasn't being used and queries are now embedded in actions

serve(async (req: Request) => {
  console.log(`[messages-helper] Received request: ${req.method} ${req.url}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[messages-helper] Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Ensure body exists and is readable
    let payload: any;
    try {
        payload = await req.json();
        console.log('[messages-helper] Request payload:', payload);
    } catch (parseError) {
        console.error('[messages-helper] Error parsing request body:', parseError);
        return new Response(JSON.stringify({ error: 'Invalid request body: ' + parseError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { action, userId, conversationId, currentUserId, otherUserId, updates } = payload;

    // Validate action
    if (!action) {
        console.error('[messages-helper] Error: Action is required in payload.');
        // Return a proper JSON error response
        return new Response(JSON.stringify({ error: 'Action is required' }), {
             status: 400,
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         });
    }
     console.log(`[messages-helper] Processing action: ${action}`);

    // Get supabase client using SERVICE_ROLE_KEY for admin privileges
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
     console.log('[messages-helper] Supabase admin client initialized.');

    let result: any = null; // Use 'any' for flexibility in result structure

    // Route to the appropriate action
    switch (action) {
      case 'getConversations':
      case 'getArchivedConversations':
      case 'getDeletedConversations': {
         console.log(`[messages-helper/${action}] Starting for user: ${userId}`);
        if (!userId) {
          console.error(`[messages-helper/${action}] Error: userId is required.`);
          // Return a proper JSON error response
           return new Response(JSON.stringify({ error: 'userId is required' }), {
               status: 400,
               headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
        }

        // 1. Find conversation IDs where the user is a participant
        console.log(`[messages-helper/${action}] Fetching participant records for user: ${userId}`);
         // Rename the error variable here to avoid conflict
        const { data: participantRecords, error: participantFetchError } = await supabaseAdmin
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', userId);

        if (participantFetchError) {
          console.error(`[messages-helper/${action}] Error fetching participant records:`, participantFetchError);
          // Throwing here will be caught by the main try/catch block
          throw participantFetchError;
        }
        console.log(`[messages-helper/${action}] Found ${participantRecords?.length || 0} participation records.`);


        const conversationIds = participantRecords?.map((p: any) => p.conversation_id) || [];

        if (conversationIds.length === 0) {
           console.log(`[messages-helper/${action}] No conversations found for user ${userId}.`);
           result = { conversations: [] };
           break; // Exit switch case early
        }
         console.log(`[messages-helper/${action}] Fetching details for conversation IDs:`, conversationIds);


        // 2. Build the query based on the action
        let query = supabaseAdmin
             .from('conversations')
             .select(`
                 id, subject, is_group, archived, created_at, updated_at, created_by, deleted_at,
                 participants:conversation_participants(
                     user_id,
                     added_at,
                     profile:profiles(id, first_name, last_name, avatar_url, role)
                 ),
                 last_message:messages!messages_conversation_id_fkey(
                     id, content, created_at, sender_id, read
                 )
             `)
             .in('id', conversationIds)
             .order('created_at', { foreignTable: 'messages', ascending: false })
             .limit(1, { foreignTable: 'messages' });

        // Apply filters based on action
        if (action === 'getConversations') {
             console.log(`[messages-helper/${action}] Applying filters: archived=false, deleted_at=null`);
            query = query.eq('archived', false).is('deleted_at', null);
        } else if (action === 'getArchivedConversations') {
             console.log(`[messages-helper/${action}] Applying filters: archived=true, deleted_at=null`);
            query = query.eq('archived', true).is('deleted_at', null);
        } else if (action === 'getDeletedConversations') {
             console.log(`[messages-helper/${action}] Applying filters: deleted_at!=null`);
            query = query.not('deleted_at', 'is', null);
        }

        // Execute the query
        const { data: convDetails, error: convDetailsError } = await query;

        if (convDetailsError) {
          console.error(`[messages-helper/${action}] Error fetching conversation details:`, convDetailsError);
          throw convDetailsError;
        }
         console.log(`[messages-helper/${action}] Raw conversation details fetched:`, convDetails?.length || 0);


         // Process messages to ensure only the last one is attached and profiles are enriched
         const processedConversations = (convDetails || []).map((conv: any) => {
             // Ensure last_message is a single object or null
             if (conv.last_message && Array.isArray(conv.last_message)) {
                 conv.last_message = conv.last_message[0] || null;
             } else if (!conv.last_message) {
                 conv.last_message = null;
             }

             // Enrich participant profiles (if they exist)
             if (conv.participants && Array.isArray(conv.participants)) {
                 conv.participants = conv.participants.map((p: any) => {
                     if (p.profile) {
                         // Basic enrichment example (assuming role exists)
                         // You might need a more robust enrichProfileWithRoles function here if needed
                         p.profile.roles = p.profile.role ? [p.profile.role] : ['student'];
                     }
                     return p;
                 });
             }

             return conv;
         });


        console.log(`[messages-helper/${action}] Retrieved ${processedConversations?.length || 0} conversations.`);
        result = { conversations: processedConversations };
        break;
      } // End of combined conversation fetching cases

      case 'getMessages':
        console.log(`[messages-helper/getMessages] Starting for conversation: ${conversationId}`);
        if (!conversationId) {
          console.error('[messages-helper/getMessages] Error: conversationId is required.');
          // Return JSON error
           return new Response(JSON.stringify({ error: 'conversationId is required' }), {
               status: 400,
               headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
        }

        // Fetch messages for the conversation, including sender profile
         console.log(`[messages-helper/getMessages] Fetching messages and sender profiles for conversation: ${conversationId}`);
        const { data: messages, error: messagesError } = await supabaseAdmin
          .from('messages')
           .select(`
             id,
             sender_id,
             conversation_id,
             content,
             attachment_url,
             read,
             created_at,
             sender:profiles!sender_id(
               id,
               first_name,
               last_name,
               avatar_url,
               role
             )
           `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('[messages-helper/getMessages] Error fetching messages:', messagesError);
          throw messagesError;
        }
         console.log(`[messages-helper/getMessages] Fetched ${messages?.length || 0} messages.`);

        // Enrich sender profiles in messages
        const messagesWithProfiles = (messages || []).map((message: any) => ({
           ...message,
           // Basic enrichment, adapt if needed
           sender: message.sender ? { ...message.sender, roles: message.sender.role ? [message.sender.role] : ['student'] } : null
        }));

        result = { messages: messagesWithProfiles };
        break;


      case 'checkOneOnOneConversation':
         console.log(`[messages-helper/checkOneOnOneConversation] Checking between ${currentUserId} and ${otherUserId}`);
        if (!currentUserId || !otherUserId) {
           console.error('[messages-helper/checkOneOnOneConversation] Error: Both currentUserId and otherUserId are required.');
           // Return JSON error
           return new Response(JSON.stringify({ error: 'Both currentUserId and otherUserId are required' }), {
               status: 400,
               headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
        }

        // Find conversations where both users are participants and it's not a group conversation, not archived, not deleted
         console.log('[messages-helper/checkOneOnOneConversation] Querying for existing conversations...');
        const { data: existingConversations, error: existingConvError } = await supabaseAdmin
          .rpc('find_one_on_one_conversation', { user1_id: currentUserId, user2_id: otherUserId });
          // Note: This requires a DB function `find_one_on_one_conversation`
          // Example function:
          /*
          CREATE OR REPLACE FUNCTION find_one_on_one_conversation(user1_id uuid, user2_id uuid)
          RETURNS TABLE(conversation_id uuid) AS $$
          BEGIN
              RETURN QUERY
              SELECT cp1.conversation_id
              FROM conversation_participants cp1
              JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
              JOIN conversations c ON cp1.conversation_id = c.id
              WHERE cp1.user_id = user1_id
                AND cp2.user_id = user2_id
                AND c.is_group = false
                AND c.archived = false
                AND c.deleted_at IS NULL
              LIMIT 1;
          END;
          $$ LANGUAGE plpgsql;
          */

        if (existingConvError) {
          console.error('[messages-helper/checkOneOnOneConversation] Error executing DB function:', existingConvError);
          throw existingConvError;
        }

        const conversationMatch = existingConversations?.[0]; // RPC returns an array

        if (conversationMatch?.conversation_id) {
          console.log('[messages-helper/checkOneOnOneConversation] Found one-on-one conversation:', conversationMatch.conversation_id);
          result = { conversation: { id: conversationMatch.conversation_id } };
        } else {
          console.log('[messages-helper/checkOneOnOneConversation] No active one-on-one conversation found.');
          result = { conversation: null };
        }
        break;


      case 'updateConversation':
        console.log(`[messages-helper/updateConversation] Updating conv ${conversationId} for user ${userId}`);
        if (!conversationId || !userId || !updates) {
           console.error('[messages-helper/updateConversation] Error: conversationId, userId, and updates are required.');
           // Return JSON error
            return new Response(JSON.stringify({ error: 'conversationId, userId, and updates are required' }), {
               status: 400,
               headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
        }

        // 1. Verify user is a participant (using admin client)
        console.log(`[messages-helper/updateConversation] Checking participation for user ${userId} in conv ${conversationId}`);
        const { data: participant, error: checkError } = await supabaseAdmin
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conversationId)
          .eq('user_id', userId)
          .maybeSingle(); // Use maybeSingle to handle not found gracefully

         if (checkError) {
             console.error('[messages-helper/updateConversation] Error checking participation:', checkError);
             // Don't necessarily throw, could be transient DB issue, let the update fail if needed
             // throw new Error('Failed to verify participation');
         }

        if (!participant) {
          // Log a warning but proceed. The function acts with admin rights.
          // The frontend service function might have already checked, but this is a safeguard log.
          console.warn(`[messages-helper/updateConversation] Warning: User ${userId} is not a participant of conversation ${conversationId}, but proceeding with admin rights.`);
          // Depending on strictness, you could throw: throw new Error('User is not a participant');
        } else {
           console.log(`[messages-helper/updateConversation] User ${userId} confirmed as participant.`);
        }

        // 2. Perform the update with admin privileges
         console.log(`[messages-helper/updateConversation] Performing update on conv ${conversationId} with data:`, updates);
        const { data: updatedData, error: updateError } = await supabaseAdmin
          .from('conversations')
          .update(updates)
          .eq('id', conversationId)
          .select() // Select the updated row
           .maybeSingle(); // Use maybeSingle in case the conversation was deleted concurrently

        if (updateError) {
          console.error('[messages-helper/updateConversation] Error updating conversation:', updateError);
          throw updateError;
        }

        if (!updatedData) {
           console.warn(`[messages-helper/updateConversation] No conversation found with ID ${conversationId} to update, or RLS prevented the update (though using admin should bypass).`);
           // Decide if this should be an error or just return null
            result = { conversation: null }; // Indicate no conversation was updated
        } else {
           console.log(`[messages-helper/updateConversation] Successfully updated conversation ${conversationId}`);
           result = { conversation: updatedData };
        }
        break;


      default:
         console.error(`[messages-helper] Error: Unsupported action: ${action}`);
         // Return JSON error
         return new Response(JSON.stringify({ error: `Unsupported action: ${action}` }), {
             status: 400,
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         });
    }

     console.log(`[messages-helper] Action ${action} completed successfully. Returning result.`);
    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200 // Explicitly set success status
      }
    );
  } catch (error) {
    console.error('[messages-helper] General Error:', error);
    // Ensure error is an Error object
    const errorMessage = error instanceof Error ? error.message : String(error);
     // Determine appropriate status code based on error type if possible, default to 500 for server errors
     const status = (error.message === 'Action is required' || error.message.includes('required')) ? 400 : 500;

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

// Add the missing DB function if it doesn't exist
/*
-- Run this in Supabase SQL Editor if needed:
CREATE OR REPLACE FUNCTION public.find_one_on_one_conversation(user1_id uuid, user2_id uuid)
RETURNS TABLE(conversation_id uuid) AS $$
BEGIN
    RETURN QUERY
    SELECT cp1.conversation_id
    FROM public.conversation_participants cp1
    JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    JOIN public.conversations c ON cp1.conversation_id = c.id
    WHERE cp1.user_id = user1_id
      AND cp2.user_id = user2_id
      AND c.is_group = false
      AND c.archived = false
      AND c.deleted_at IS NULL
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Use SECURITY DEFINER if called by admin function
*/
