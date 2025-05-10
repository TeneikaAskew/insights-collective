
import { corsHeaders } from '../_shared/utils.ts'

const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');

Deno.serve(async (req) => {
  // Get the stream ID from query params
  const url = new URL(req.url);
  const streamId = url.searchParams.get('id');
  
  if (!streamId) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Missing stream ID' 
    }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // Get the stored request parameters
  const storedParamsString = await Deno.env.get(`STREAM_${streamId}`);
  if (!storedParamsString) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid or expired stream ID' 
    }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  // Parse the stored parameters
  const { model, prompt, max_tokens } = JSON.parse(storedParamsString);

  if (!togetherApiKey) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Together.ai API key not configured' 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  const encoder = new TextEncoder();
  const body = encoder.encode(`data: ${JSON.stringify({ status: "connecting" })}\n\n`);
  
  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(body);
      
      try {
        // Make the streaming request to Together.ai API
        const response = await fetch('https://api.together.xyz/v1/completions', {
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
            stream: true
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Together API error:', errorText);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorText })}\n\n`));
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          controller.close();
          return;
        }

        // Read the Together.ai API response and forward the data to the client
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            const chunk = new TextDecoder().decode(value);
            
            // Parse the Server-Sent Events format from Together.ai
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const jsonString = line.slice(5).trim();
                  if (jsonString) {
                    // Forward the data to the client
                    controller.enqueue(encoder.encode(`data: ${jsonString}\n\n`));
                  }
                } catch (e) {
                  console.error('Error parsing JSON:', e);
                }
              }
            }
          }
        }

        // Send a done event to the client
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      } catch (error) {
        console.error('Error in streaming function:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      } finally {
        // Clean up the stored parameters
        await Deno.env.delete(`STREAM_${streamId}`);
        controller.close();
      }
    }
  });

  // Return a streaming response
  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
});
