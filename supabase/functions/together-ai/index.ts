// Import the proper Together.ai client
import { Together } from 'https://esm.sh/@together-ai/together-node';
import { corsHeaders } from '../_shared/utils.ts';

// Get API key from environment
const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');

// Initialize Together client
const together = new Together({
  apiKey: togetherApiKey,
});

// Handle CORS preflight requests
const handleCors = (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
};

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { prompt, chatHistory = [], model = 'meta-llama/Llama-3-8b-chat-hf', max_tokens = 1024, stream = false } = await req.json();

    if (!prompt && chatHistory.length === 0) {
      throw new Error('Either prompt or chatHistory is required');
    }

    if (!togetherApiKey) {
      throw new Error('Together.ai API key not configured');
    }

    console.log(`Making request to Together API for model: ${model}, streaming: ${stream}`);
    
    // Prepare messages for the chat API
    let messages = [];
    
    // If chat history is provided, use it directly
    if (chatHistory.length > 0) {
      messages = chatHistory;
    } else {
      // Otherwise, create a basic user prompt message
      messages = [
        {
          role: "system",
          content: "You are a professional resume coach assisting users with improving their resumes. Be constructive, honest, and professional."
        },
        {
          role: "user",
          content: prompt
        }
      ];
    }

    // For streaming responses
    if (stream) {
      console.log('Streaming response from Together API');
      
      // Create a new ReadableStream that will be returned to the client
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Use the Together client to create a streaming completion
            const togetherStream = await together.chat.completions.create({
              model,
              messages,
              max_tokens,
              temperature: 0.7,
              top_p: 0.8,
              stream: true,
            });
            
            // Process each chunk from the Together stream
            for await (const chunk of togetherStream) {
              // Format the chunk as an SSE event
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                // Convert the chunk to proper SSE format
                const data = JSON.stringify({
                  choices: [{ delta: { content } }]
                });
                
                // Send the chunk to the client
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }
            
            // Signal the end of the stream
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Error in Together streaming:', error);
            controller.error(error);
          }
        }
      });
      
      // Return the stream to the client
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }
    
    // For non-streaming responses
    const response = await together.chat.completions.create({
      model,
      messages,
      max_tokens,
      temperature: 0.7,
      top_p: 0.8,
      stream: false,
    });
    
    return new Response(JSON.stringify({
      success: true,
      data: response
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
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
// // Import the proper Together.ai client
// import { Together } from 'https://esm.sh/@together-ai/together-node';
// import { corsHeaders } from '../_shared/utils.ts';

// // Get API key from environment
// const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');

// // Initialize Together client
// const together = new Together({
//   apiKey: togetherApiKey,
// });

// // Handle CORS preflight requests
// const handleCors = (req: Request) => {
//   if (req.method === 'OPTIONS') {
//     return new Response(null, { headers: corsHeaders });
//   }
// };

// Deno.serve(async (req) => {
//   // Handle CORS
//   const corsResponse = handleCors(req);
//   if (corsResponse) return corsResponse;

//   try {
//     // Parse the request body
//     const requestBody = await req.json();
//     const { 
//       prompt, 
//       chatHistory = [], 
//       model = 'meta-llama/Llama-3-8b-chat-hf', 
//       max_tokens = 1024, 
//       stream = false 
//     } = requestBody;

//     if (!prompt && chatHistory.length === 0) {
//       throw new Error('Either prompt or chatHistory is required');
//     }

//     if (!togetherApiKey) {
//       throw new Error('Together.ai API key not configured');
//     }

//     console.log(`Making request to Together API for model: ${model}, streaming: ${stream}`);
    
//     // Prepare messages for the chat API
//     let messages = [];
    
//     // If chat history is provided, use it directly
//     if (chatHistory.length > 0) {
//       messages = chatHistory;
//     } else {
//       // Otherwise, create a basic user prompt message
//       messages = [
//         {
//           role: "system",
//           content: "You are a professional resume coach assisting users with improving their resumes. Be constructive, honest, and professional."
//         },
//         {
//           role: "user",
//           content: prompt
//         }
//       ];
//     }

//     // For streaming responses
//     if (stream) {
//       console.log('Streaming response from Together API');
      
//       // Create a new ReadableStream that will be returned to the client
//       const encoder = new TextEncoder();
//       const stream = new ReadableStream({
//         async start(controller) {
//           try {
//             // Use the Together client to create a streaming completion
//             const togetherStream = await together.chat.completions.create({
//               model,
//               messages,
//               max_tokens,
//               temperature: 0.7,
//               top_p: 0.8,
//               stream: true,
//             });
            
//             // Process each chunk from the Together stream
//             for await (const chunk of togetherStream) {
//               // Format the chunk as an SSE event
//               const content = chunk.choices?.[0]?.delta?.content || '';
//               if (content) {
//                 // Convert the chunk to proper SSE format
//                 const data = JSON.stringify({
//                   choices: [{ delta: { content } }]
//                 });
                
//                 // Send the chunk to the client
//                 controller.enqueue(encoder.encode(`data: ${data}\n\n`));
//               }
//             }
            
//             // Signal the end of the stream
//             controller.enqueue(encoder.encode('data: [DONE]\n\n'));
//             controller.close();
//           } catch (error) {
//             console.error('Error in Together streaming:', error);
//             controller.error(error);
//           }
//         }
//       });
      
//       // Return the stream to the client
//       return new Response(stream, {
//         headers: {
//           ...corsHeaders,
//           'Content-Type': 'text/event-stream',
//           'Cache-Control': 'no-cache',
//           'Connection': 'keep-alive'
//         }
//       });
//     }
    
//     // For non-streaming responses
//     const response = await together.chat.completions.create({
//       model,
//       messages,
//       max_tokens,
//       temperature: 0.7,
//       top_p: 0.8,
//       stream: false,
//     });
    
//     return new Response(JSON.stringify({
//       success: true,
//       data: response
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
