import { corsHeaders } from '../_shared/utils.ts';
const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');
// Handle CORS preflight requests
const handleCors = (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
};
// Function to convert chat history to a prompt string
const formatChatHistoryToPrompt = (chatHistory)=>{
  if (!chatHistory || !Array.isArray(chatHistory) || chatHistory.length === 0) {
    throw new Error('Valid chatHistory array is required');
  }
  let formattedPrompt = '';
  // Format the chat history into a prompt string
  // This format depends on what your LLM expects
  for (const message of chatHistory){
    if (message.role === 'system') {
      formattedPrompt += `<system>\n${message.content}\n</system>\n\n`;
    } else if (message.role === 'user') {
      formattedPrompt += `<human>\n${message.content}\n</human>\n\n`;
    } else if (message.role === 'assistant') {
      formattedPrompt += `<assistant>\n${message.content}\n</assistant>\n\n`;
    }
  }
  // Add the final assistant prompt to indicate it's the AI's turn to respond
  formattedPrompt += '<assistant>\n';
  return formattedPrompt;
};
// Function to handle LLaMa-specific formatting
const formatLlamaChat = (chatHistory)=>{
  if (!chatHistory || !Array.isArray(chatHistory) || chatHistory.length === 0) {
    throw new Error('Valid chatHistory array is required');
  }
  const messages = chatHistory.map((msg)=>{
    // Map role names to what the LLaMa model expects
    const role = msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user';
    return {
      role,
      content: msg.content
    };
  });
  return {
    messages
  };
};
Deno.serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    // Log the raw request body for debugging
    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody));
    // Extract parameters with fallbacks
    const { chatHistory, prompt, model = 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', max_tokens = 1024, stream = false } = requestBody;
    // Validate we have either chatHistory or prompt mistralai/Mixtral-8x7B-Instruct-v0.1
    if (!chatHistory && !prompt) {
      throw new Error('Either chatHistory or prompt is required');
    }
    if (!togetherApiKey) {
      throw new Error('Together.ai API key not configured');
    }
    // Check if we're using a LLaMa model
    const isLlamaModel = model.toLowerCase().includes('llama');
    // Prepare the API request body
    let apiRequestBody;
    if (isLlamaModel) {
      // For LLaMa models, use the chat completions API format
      apiRequestBody = {
        model,
        ...formatLlamaChat(chatHistory),
        max_tokens,
        temperature: 0.7,
        top_p: 0.8,
        top_k: 50,
        stream
      };
      console.log(`Making request to Together Chat Completions API for model: ${model}, streaming: ${stream}`);
      // Call Together.ai Chat Completions API
      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${togetherApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiRequestBody)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Together API error:', errorText);
        throw new Error(`Together API returned status ${response.status}: ${errorText}`);
      }
      // Forward the streaming response
      if (stream) {
        console.log('Streaming response from Together Chat Completions API');
        return new Response(response.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      }
      // For non-streaming responses
      const data = await response.json();
      return new Response(JSON.stringify({
        success: true,
        data
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else {
      // For non-LLaMa models, use the completions API with prompt
      // Convert chat history to prompt if needed
      const finalPrompt = prompt || formatChatHistoryToPrompt(chatHistory);
      apiRequestBody = {
        model,
        prompt: finalPrompt,
        max_tokens,
        temperature: 0.7,
        top_p: 0.8,
        top_k: 50,
        stream
      };
      console.log(`Making request to Together Completions API for model: ${model}, streaming: ${stream}`);
      // Call Together.ai Completions API
      const response = await fetch('https://api.together.xyz/v1/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${togetherApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiRequestBody)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Together API error:', errorText);
        throw new Error(`Together API returned status ${response.status}: ${errorText}`);
      }
      // For streaming responses
      if (stream) {
        console.log('Streaming response from Together Completions API');
        return new Response(response.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      }
      // For non-streaming responses
      const data = await response.json();
      return new Response(JSON.stringify({
        success: true,
        data
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Error in together-ai function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}); // import { corsHeaders } from '../_shared/utils.ts';
 // const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');
 // // Handle CORS preflight requests
 // const handleCors = (req)=>{
 //   if (req.method === 'OPTIONS') {
 //     return new Response(null, {
 //       headers: corsHeaders
 //     });
 //   }
 // };
 // Deno.serve(async (req)=>{
 //   // Handle CORS
 //   const corsResponse = handleCors(req);
 //   if (corsResponse) return corsResponse;
 //   try {
 //     const { prompt, model, max_tokens = 1024, stream = false } = await req.json();
 //     if (!prompt) {
 //       console.log(prompt, model, max_tokens, stream);
 //       throw new Error('Prompt is required');
 //     }
 //     if (!togetherApiKey) {
 //       throw new Error('Together.ai API key not configured');
 //     }
 //     console.log(`Making request to Together API for model: ${model}, streaming: ${stream}`);
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
 //         top_k: 50,
 //         stream
 //       })
 //     });
 //     if (!response.ok) {
 //       const errorText = await response.text();
 //       console.error('Together API error:', errorText);
 //       throw new Error(`Together API returned status ${response.status}: ${errorText}`);
 //     }
 //     // For streaming responses
 //     if (stream) {
 //       console.log('Streaming response from Together API');
 //       return new Response(response.body, {
 //         headers: {
 //           ...corsHeaders,
 //           'Content-Type': 'text/event-stream',
 //           'Cache-Control': 'no-cache',
 //           'Connection': 'keep-alive'
 //         }
 //       });
 //     }
 //     // For non-streaming responses
 //     const data = await response.json();
 //     return new Response(JSON.stringify({
 //       success: true,
 //       data
 //     }), {
 //       headers: {
 //         ...corsHeaders,
 //         'Content-Type': 'application/json'
 //       }
 //     });
 //   } catch (error) {
 //     console.error('Error in together-ai function:', error);
 //     return new Response(JSON.stringify({
 //       success: false,
 //       error: error.message
 //     }), {
 //       status: 500,
 //       headers: {
 //         ...corsHeaders,
 //         'Content-Type': 'application/json'
 //       }
 //     });
 //   }
 // });
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
