// ABOUTME: Generic AI edge function used by the useTogetherAI hook
// ABOUTME: Routes requests to Gemini 2.5 Flash via the Lovable AI Gateway

import { corsHeaders } from '../_shared/utils.ts';
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

// Handle CORS preflight requests
const handleCors = (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody));

    const { chatHistory, prompt, model = 'google/gemini-2.5-flash', max_tokens = 1024, stream = false } = requestBody;

    if (!chatHistory && !prompt) {
      throw new Error('Either chatHistory or prompt is required');
    }
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build messages array from chatHistory or prompt
    let messages;
    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      messages = chatHistory.map((msg) => ({
        role: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: msg.content
      }));
    } else {
      messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ];
    }

    console.log(`Making request to Lovable AI Gateway for model: ${model}, streaming: ${stream}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        temperature: 0.7,
        stream
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: 'Payment required, please add funds.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI Gateway returned status ${response.status}: ${errorText}`);
    }

    if (stream) {
      console.log('Streaming response from AI Gateway');
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in together-ai function:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
