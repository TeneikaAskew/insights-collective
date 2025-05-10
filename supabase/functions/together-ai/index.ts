
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { corsHeaders } from '../_shared/utils.ts'

const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');

// Handle CORS preflight requests
const handleCors = (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { 
      prompt, 
      model = 'mistralai/Mixtral-8x7B-Instruct-v0.1', 
      max_tokens = 1024,
      stream = false
    } = await req.json();

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    if (!togetherApiKey) {
      throw new Error('Together.ai API key not configured');
    }

    const requestBody = {
      model,
      prompt,
      max_tokens,
      temperature: 0.7,
      top_p: 0.8,
      top_k: 50,
      stream
    };

    if (stream) {
      // For streaming, create a stream URL that clients can connect to
      // We use a simple token generation for security - in production, use something more robust
      const streamId = crypto.randomUUID();
      const streamURL = `${req.url.replace('/together-ai', '/together-ai-stream')}?id=${streamId}`;
      
      // Store the streaming request params where it can be retrieved by the streaming endpoint
      // In a production system, use a more robust storage method
      await Deno.env.set(`STREAM_${streamId}`, JSON.stringify({
        model,
        prompt,
        max_tokens,
        streamId
      }));
      
      return new Response(JSON.stringify({ 
        success: true, 
        stream_url: streamURL,
        stream_id: streamId
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    } else {
      // For non-streaming, directly call Together API
      const response = await fetch('https://api.together.xyz/v1/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${togetherApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Together API error:', errorText);
        throw new Error(`Together API returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      return new Response(JSON.stringify({ 
        success: true, 
        data 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  } catch (error) {
    console.error('Error in together-ai function:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
