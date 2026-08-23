
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Deployed with verify_jwt=false: an unauthenticated LLM endpoint billed to
  // this project.
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { conversationHistory, messageType } = await req.json();

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build context based on conversation history
    let systemPrompt = 'You are a helpful assistant that generates appropriate conversation messages. Generate a friendly, professional message that fits the context.';
    
    if (messageType === 'followup' && conversationHistory && conversationHistory.length > 0) {
      const lastMessage = conversationHistory[conversationHistory.length - 1];
      systemPrompt += ` The last message in the conversation was: "${lastMessage.content}". Generate an appropriate follow-up message.`;
    } else {
      systemPrompt += ' Generate a friendly conversation starter message.';
    }

    // Prepare messages for Together API
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate a brief, friendly message for this conversation context.' }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Together API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices[0].message.content.trim();

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-message function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
