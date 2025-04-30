
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        
        console.log('Getting conversations for user:', userId);
        
        // Use the improved database function to get conversations for the user
        const { data: conversations, error: conversationsError } = await supabaseAdmin.rpc(
          'get_user_conversations',
          { user_id_param: userId }
        );
        
        if (conversationsError) {
          console.error('Error fetching conversations:', conversationsError);
          throw conversationsError;
        }
        
        console.log(`Retrieved ${conversations?.length || 0} conversations`);
        result = { conversations };
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
        
        // Fetch archived conversations for the user from the view
        const { data: archivedConversations, error: archivedError } = await supabaseAdmin
          .from('conversation')
          .select('*')
          .eq('user_id', userId)
          .eq('archived', true);
          
        if (archivedError) {
          console.error('Error fetching archived conversations:', archivedError);
          throw archivedError;
        }
        
        result = { conversations: archivedConversations };
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
