
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
    const { action, userId, conversationId } = await req.json();
    
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
        
        // Fetch conversations for the user using direct SQL to avoid infinite recursion
        const { data: conversations, error: conversationsError } = await supabaseAdmin.rpc(
          'get_user_conversations',
          { user_id_param: userId }
        );
        
        if (conversationsError) {
          throw conversationsError;
        }
        
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
