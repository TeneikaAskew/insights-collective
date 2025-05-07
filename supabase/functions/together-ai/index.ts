// src/functions/together-stream.ts
import { corsHeaders } from '../_shared/utils.ts';
const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');

function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

Deno.serve(async (req) => {
  // CORS preflight
  const pre = handleCors(req);
  if (pre) return pre;

  try {
    const { prompt, model = 'mistralai/Mixtral-8x7B-Instruct-v0.1', max_tokens = 1024 } = await req.json();
    if (!prompt) throw new Error('`prompt` is required');
    if (!togetherApiKey) throw new Error('TOGETHER_API_KEY is not set');

    const res = await fetch('https://api.together.xyz/v1/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${togetherApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt,
        max_tokens,
        temperature: 0.7,
        top_p: 0.8,
        top_k: 50,
        stream: true         // ← critical!
      })
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Together API ${res.status}: ${txt}`);
    }

    // pipe the raw ReadableStream back with SSE‐style headers
    return new Response(res.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
// import { corsHeaders } from '../_shared/utils.ts'

// const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');

// // Handle CORS preflight requests
// const handleCors = (req: Request) => {
//   if (req.method === 'OPTIONS') {
//     return new Response(null, { headers: corsHeaders })
//   }
// }

// Deno.serve(async (req) => {
//   // Handle CORS
//   const corsResponse = handleCors(req);
//   if (corsResponse) return corsResponse;

//   try {
//     const { prompt, model = 'mistralai/Mixtral-8x7B-Instruct-v0.1', max_tokens = 1024 } = await req.json();

//     if (!prompt) {
//       throw new Error('Prompt is required');
//     }

//     if (!togetherApiKey) {
//       throw new Error('Together.ai API key not configured');
//     }

//     // Call Together.ai API
//     const response = await fetch('https://api.together.xyz/v1/completions', {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${togetherApiKey}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         model,
//         prompt,
//         max_tokens,
//         temperature: 0.7,
//         top_p: 0.8,
//         top_k: 50
//       })
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error('Together API error:', errorText);
//       throw new Error(`Together API returned status ${response.status}: ${errorText}`);
//     }

//     const data = await response.json();
    
//     return new Response(JSON.stringify({ 
//       success: true, 
//       data 
//     }), { 
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
//     });
//   } catch (error) {
//     console.error('Error in together-ai function:', error);
    
//     return new Response(JSON.stringify({ 
//       success: false, 
//       error: error.message 
//     }), { 
//       status: 500, 
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
//     });
//   }
// });
