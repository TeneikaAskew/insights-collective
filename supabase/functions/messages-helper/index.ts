
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to fetch conversation details including participants and last message
const fetchConversationDetails = async (supabaseAdmin: any, conversationIds: string[]) => {
    if (!conversationIds || conversationIds.length === 0) {
        return [];
    }

    const { data: conversations, error: convError } = await supabaseAdmin
        .from('conversations')
        .select(`
            *,
            participants:conversation_participants(
                user_id,
                added_at,
                profile:profiles(id, first_name, last_name, avatar_url)
            ),
            last_message:messages!messages_conversation_id_fkey(
                id, content, created_at, sender_id, read
            )
        `)
        .in('id', conversationIds)
        .order('created_at', { foreignTable: 'messages', ascending: false }) // Order messages within each conversation
        .limit(1, { foreignTable: 'messages' }); // Limit to the last message

    if (convError) {
        console.error('Error fetching conversation details:', convError);
        throw convError;
    }

    // The query above might return multiple message rows if not structured perfectly.
    // We need to ensure only one 'last_message' per conversation.
    // This processing step groups messages by conversation and selects the latest one.
    const conversationMap = new Map<string, any>();
    conversations.forEach((conv: any) => {
        const existing = conversationMap.get(conv.id);
        if (!existing) {
            // If the conversation has messages, ensure 'last_message' is an object, not array
            if (conv.last_message && Array.isArray(conv.last_message)) {
                 conv.last_message = conv.last_message[0] || null;
            } else if (!conv.last_message) {
                 conv.last_message = null; // Ensure it's null if no messages
            }
            conversationMap.set(conv.id, conv);
        } else {
             // If somehow duplicates exist, maybe update based on timestamp? (Less likely with correct query)
             // For simplicity, we assume the query returns unique conversations here.
        }
    });


    return Array.from(conversationMap.values());
};


serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, userId, conversationId, currentUserId, otherUserId } = await req.json();

    // Get supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let result = null;

    // Route to the appropriate action
    switch (action) {
      case 'getConversations':
        if (!userId) {
          throw new Error('userId is required');
        }

        console.log('Getting non-deleted, non-archived conversations for user:', userId);

        // 1. Find conversation IDs where the user is a participant and conversation is not deleted/archived
        const { data: activeParticipantRecords, error: activePartError } = await supabaseAdmin
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', userId);

        if (activePartError) {
          console.error('Error fetching active participant records:', activePartError);
          throw activePartError;
        }

        const activeConversationIds = activeParticipantRecords.map((p: any) => p.conversation_id);

        // 2. Fetch details for those active, non-deleted, non-archived conversations
         const { data: activeConvDetails, error: activeConvDetailsError } = await supabaseAdmin
             .from('conversations')
             .select(`
                 id, subject, is_group, archived, created_at, updated_at, created_by, deleted_at,
                 participants:conversation_participants(
                     user_id,
                     added_at,
                     profile:profiles(id, first_name, last_name, avatar_url)
                 ),
                 last_message:messages!messages_conversation_id_fkey(
                     id, content, created_at, sender_id, read
                 )
             `)
             .in('id', activeConversationIds)
             .eq('archived', false)
             .is('deleted_at', null) // Ensure not deleted
             .order('created_at', { foreignTable: 'messages', ascending: false })
             .limit(1, { foreignTable: 'messages' });


        if (activeConvDetailsError) {
          console.error('Error fetching active conversation details:', activeConvDetailsError);
          throw activeConvDetailsError;
        }

         // Process messages to ensure only the last one is attached
         const processedActiveConversations = activeConvDetails.map((conv: any) => {
             if (conv.last_message && Array.isArray(conv.last_message)) {
                 conv.last_message = conv.last_message[0] || null;
             } else if (!conv.last_message) {
                 conv.last_message = null;
             }
             return conv;
         });


        console.log(`Retrieved ${processedActiveConversations?.length || 0} active conversations`);
        result = { conversations: processedActiveConversations };
        break;

      case 'getMessages':
        if (!conversationId) {
          throw new Error('conversationId is required');
        }
        
        // Fetch messages for the conversation
        const { data: messages, error: messagesError } = await supabaseAdmin
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });
          
        if (messagesError) {
          throw messagesError;
        }
        
        result = { messages };
        break;
        
      case 'getArchivedConversations':
         if (!userId) {
             throw new Error('userId is required');
         }
         console.log('Getting archived conversations for user:', userId);

         // 1. Find conversation IDs where the user is a participant
         const { data: participantRecords, error: partError } = await supabaseAdmin
             .from('conversation_participants')
             .select('conversation_id')
             .eq('user_id', userId);

         if (partError) {
             console.error('Error fetching participant records:', partError);
             throw partError;
         }

         const conversationIds = participantRecords.map((p: any) => p.conversation_id);

         // 2. Fetch details for conversations that are archived and not deleted
         const { data: archivedConvDetails, error: archivedError } = await supabaseAdmin
             .from('conversations')
             .select(`
                 id, subject, is_group, archived, created_at, updated_at, created_by, deleted_at,
                 participants:conversation_participants(
                     user_id,
                     added_at,
                     profile:profiles(id, first_name, last_name, avatar_url)
                 ),
                 last_message:messages!messages_conversation_id_fkey(
                     id, content, created_at, sender_id, read
                 )
             `)
             .in('id', conversationIds)
             .eq('archived', true)
             .is('deleted_at', null) // Ensure not deleted
             .order('created_at', { foreignTable: 'messages', ascending: false })
             .limit(1, { foreignTable: 'messages' });


         if (archivedError) {
             console.error('Error fetching archived conversation details:', archivedError);
             throw archivedError;
         }

          // Process messages
          const processedArchivedConversations = archivedConvDetails.map((conv: any) => {
              if (conv.last_message && Array.isArray(conv.last_message)) {
                  conv.last_message = conv.last_message[0] || null;
              } else if (!conv.last_message) {
                  conv.last_message = null;
              }
              return conv;
          });

         console.log(`Retrieved ${processedArchivedConversations?.length || 0} archived conversations`);
         result = { conversations: processedArchivedConversations };
         break;

      case 'getDeletedConversations': // New case
        if (!userId) {
          throw new Error('userId is required');
        }
        console.log('Getting deleted conversations for user:', userId);

        // 1. Find conversation IDs where the user is a participant
        const { data: delParticipantRecords, error: delPartError } = await supabaseAdmin
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', userId);

        if (delPartError) {
            console.error('Error fetching participant records for deleted:', delPartError);
            throw delPartError;
        }

        const delConversationIds = delParticipantRecords.map((p: any) => p.conversation_id);

        // 2. Fetch details for conversations that are deleted (deleted_at is not null)
         const { data: deletedConvDetails, error: deletedError } = await supabaseAdmin
             .from('conversations')
             .select(`
                 id, subject, is_group, archived, created_at, updated_at, created_by, deleted_at,
                 participants:conversation_participants(
                     user_id,
                     added_at,
                     profile:profiles(id, first_name, last_name, avatar_url)
                 ),
                 last_message:messages!messages_conversation_id_fkey(
                     id, content, created_at, sender_id, read
                 )
             `)
             .in('id', delConversationIds)
             .not('deleted_at', 'is', null) // Fetch where deleted_at is NOT NULL
             .order('created_at', { foreignTable: 'messages', ascending: false })
             .limit(1, { foreignTable: 'messages' });


        if (deletedError) {
          console.error('Error fetching deleted conversation details:', deletedError);
          throw deletedError;
        }

        // Process messages
        const processedDeletedConversations = deletedConvDetails.map((conv: any) => {
            if (conv.last_message && Array.isArray(conv.last_message)) {
                conv.last_message = conv.last_message[0] || null;
            } else if (!conv.last_message) {
                conv.last_message = null;
            }
            return conv;
        });

        console.log(`Retrieved ${processedDeletedConversations?.length || 0} deleted conversations`);
        result = { conversations: processedDeletedConversations };
        break;

      case 'checkOneOnOneConversation':
        if (!currentUserId || !otherUserId) {
          throw new Error('Both currentUserId and otherUserId are required');
        }
        
        console.log('Checking for one-on-one conversation between', currentUserId, 'and', otherUserId);
        
        // Find conversations where both users are participants and it's not a group conversation
        const { data: existingConversations, error: existingConvError } = await supabaseAdmin
          .from('conversations')
          .select(`
            id,
            is_group,
            created_at,
            conversation_participants!inner(user_id)
          `)
          .eq('is_group', false)
          .eq('archived', false);
        
        if (existingConvError) {
          console.error('Error checking for existing conversations:', existingConvError);
          throw existingConvError;
        }
        
        // Filter to find conversations where both users are participants
        const oneOnOneConversation = existingConversations?.find(conv => {
          // Check if this conversation has exactly 2 participants
          if (conv.conversation_participants?.length !== 2) return false;
          
          // Check if both users are participants in this conversation
          const userIds = conv.conversation_participants.map(p => p.user_id);
          return userIds.includes(currentUserId) && userIds.includes(otherUserId);
        });
        
        if (oneOnOneConversation) {
          console.log('Found one-on-one conversation:', oneOnOneConversation.id);
          result = { conversation: { id: oneOnOneConversation.id } };
        } else {
          console.log('No one-on-one conversation found');
          result = { conversation: null };
        }
        break;
        
      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

