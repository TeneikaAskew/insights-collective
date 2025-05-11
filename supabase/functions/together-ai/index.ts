const handleSendMessage = async () => {
  if (!inputValue.trim() || isLoading) return;

  const userMessage: Message = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: inputValue,
    displayContent: inputValue,
    timestamp: new Date(),
    useTypingAnimation: false
  };
  
  // Create a placeholder streaming message
  const streamingMessage: Message = {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: '',
    displayContent: '',
    timestamp: new Date(),
    isStreaming: true,
    useTypingAnimation: true // Use typing animation for responses
  };
  
  // Reset the buffer and set current streaming ID
  contentBufferRef.current = [];
  currentStreamingIdRef.current = streamingMessage.id;
  
  setMessages(prev => [...prev, userMessage, streamingMessage]);
  setInputValue('');
  setIsLoading(true);
  
  try {
    // Prepare the chat history for the API
    const chatHistory = messages
      .filter(msg => !msg.isStreaming) // Remove any current streaming messages
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    
    // Add the new user message
    chatHistory.push({
      role: userMessage.role,
      content: userMessage.content
    });
    
    // Abort any existing streams
    if (streamController) {
      streamController.abort();
    }
    
    // Create a new controller for this stream
    const controller = new AbortController();
    setStreamController(controller);
    
    console.log('Invoking together-ai function with chat history of', chatHistory.length, 'messages');
    
    // Make sure the chat history is not empty
    if (chatHistory.length === 0) {
      throw new Error('Chat history cannot be empty');
    }
    
    // Add a system message if there isn't one
    if (!chatHistory.some(msg => msg.role === 'system')) {
      const systemContent = resumeAnalysis ? 
        `You are a professional resume coach assisting a user with their resume.
        
Resume Context: Grade ${resumeAnalysis.letter_grade} (${resumeAnalysis.resume_percent}%). 
Key themes for improvement: ${resumeAnalysis.themes.join(', ')}.
Elevator pitch: ${resumeAnalysis.elevator_pitch}

Provide helpful, specific advice as a resume coach. Be constructive, honest, and professional.` :
        'You are a professional resume coach assisting a user with their resume.';
        
      chatHistory.unshift({
        role: 'system',
        content: systemContent
      });
    }
    
    const response = await supabase.functions.invoke('together-ai', {
      body: { 
        chatHistory, // Send the chat history
        // Also include a prompt as fallback for backwards compatibility
        prompt: `User asked: ${userMessage.content}`,
        model: 'meta-llama/Llama-3-8b-chat-hf', // Try to use Llama 3
        max_tokens: 1024,
        stream: true
      }
    });
    
    console.log('Supabase function response received:', response);
    
    if (response.error) {
      console.error('Error from Together AI:', response.error);
      throw new Error(response.error.message || 'Unknown error');
    }
    
    if (!response.data || !response.data.body) {
      console.error('No body in response data:', response.data);
      throw new Error('No readable stream in response');
    }
    
    // Get the ReadableStream from the response.data.body
    const readableStream = response.data.body;
    const reader = readableStream.getReader();
    
    // Add a timeout to handle premature stream termination
    let streamTimeout: NodeJS.Timeout | null = null;
    const MAX_SILENCE_MS = 10000; // 10 seconds without data before we consider the stream dead
    
    try {
      // Process the SSE stream
      while (true) {
        // Clear any existing timeout and set a new one
        if (streamTimeout) clearTimeout(streamTimeout);
        
        streamTimeout = setTimeout(() => {
          console.log('Stream timed out - no data received in', MAX_SILENCE_MS, 'ms');
          reader.cancel('Stream timed out');
          // Mark streaming as complete
          setMessages(prev => prev.map(msg => 
            msg.id === streamingMessage.id 
              ? { ...msg, isStreaming: false }
              : msg
          ));
          // Clear current streaming ID
          currentStreamingIdRef.current = null;
        }, MAX_SILENCE_MS);
        
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream marked as done');
          if (streamTimeout) clearTimeout(streamTimeout);
          break;
        }
        
        // Decode the chunk
        const chunk = new TextDecoder().decode(value);
        console.log('Received chunk:', chunk.substring(0, 100));
        
        // Parse SSE format - each line starts with "data: "
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              // Remove the "data: " prefix and parse the JSON
              const jsonStr = line.substring(6);
              
              // Check if it's the "[DONE]" marker
              if (jsonStr.trim() === '[DONE]') {
                console.log('Received [DONE] marker');
                continue;
              }
              
              const jsonData = JSON.parse(jsonStr);
              console.log('Parsed JSON data:', jsonData);
              
              // Extract the text from the completion choices
              // Check for the delta.content format (chat completions API)
              if (jsonData.choices && jsonData.choices[0]?.delta?.content) {
                const newText = jsonData.choices[0].delta.content;
                console.log('Received new text:', newText);
                
                // Update the full message content in state (not visible to user yet)
                setMessages(prev => {
                  const updatedMessages = prev.map(msg => {
                    if (msg.id === streamingMessage.id) {
                      return { ...msg, content: msg.content + newText };
                    }
                    return msg;
                  });
                  return updatedMessages;
                });
                
                // Only add to buffer if this message uses typing animation
                if (streamingMessage.useTypingAnimation) {
                  addContentToBuffer(newText);
                }
              }
              // Fallback for the older completions API format
              else if (jsonData.choices && jsonData.choices[0]?.text) {
                const newText = jsonData.choices[0].text;
                console.log('Received new text (legacy format):', newText);
                
                setMessages(prev => {
                  const updatedMessages = prev.map(msg => {
                    if (msg.id === streamingMessage.id) {
                      return { ...msg, content: msg.content + newText };
                    }
                    return msg;
                  });
                  return updatedMessages;
                });
                
                // Only add to buffer if this message uses typing animation
                if (streamingMessage.useTypingAnimation) {
                  addContentToBuffer(newText);
                }
              }
            } catch (e) {
              console.warn('Error parsing SSE data:', e, 'Line:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing stream:', error);
      // Still update with whatever content we got
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessage.id 
          ? { ...msg, isStreaming: false }
          : msg
      ));
      // Clear current streaming ID
      currentStreamingIdRef.current = null;
    } finally {
      // Make sure we clear any pending timeout
      if (streamTimeout) clearTimeout(streamTimeout);
      
      // Update the streaming message to mark streaming as complete
      // But keep typing animation going until buffer is empty
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessage.id 
          ? { ...msg, isStreaming: false }
          : msg
      ));
      
      setStreamController(null);
    }
    
  } catch (error) {
    console.error('Error sending message:', error);
    
    // Log more details if available
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    
    toast({
      title: "Error",
      description: `Failed to get a response from the AI: ${error.message}`,
      variant: "destructive"
    });
    
    // Fallback response
    const fallbackContent = "Thanks for sharing those details. Based on what you've told me, I'd recommend focusing on quantifying your achievements more clearly in your resume. Add specific metrics and outcomes to demonstrate your impact. Could you share a specific project where you made a significant contribution?";
    
    const fallbackMessage: Message = {
      id: `assistant-fallback-${Date.now()}`,
      role: 'assistant',
      content: fallbackContent,
      displayContent: fallbackContent, // No typing animation for fallback
      timestamp: new Date(),
      useTypingAnimation: false
    };
    
    // Remove any streaming messages and add fallback
    setMessages(prev => [...prev.filter(msg => !msg.isStreaming), fallbackMessage]);
    
  } finally {
    setIsLoading(false);
  }
};
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
//     const { prompt, chatHistory = [], model = 'meta-llama/Llama-3-8b-chat-hf', max_tokens = 1024, stream = false } = await req.json();

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
//               const content = chunk.choices[0]?.delta?.content || '';
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
// // // Import the proper Together.ai client
// // import { Together } from 'https://esm.sh/@together-ai/together-node';
// // import { corsHeaders } from '../_shared/utils.ts';

// // // Get API key from environment
// // const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');

// // // Initialize Together client
// // const together = new Together({
// //   apiKey: togetherApiKey,
// // });

// // // Handle CORS preflight requests
// // const handleCors = (req: Request) => {
// //   if (req.method === 'OPTIONS') {
// //     return new Response(null, { headers: corsHeaders });
// //   }
// // };

// // Deno.serve(async (req) => {
// //   // Handle CORS
// //   const corsResponse = handleCors(req);
// //   if (corsResponse) return corsResponse;

// //   try {
// //     // Parse the request body
// //     const requestBody = await req.json();
// //     const { 
// //       prompt, 
// //       chatHistory = [], 
// //       model = 'meta-llama/Llama-3-8b-chat-hf', 
// //       max_tokens = 1024, 
// //       stream = false 
// //     } = requestBody;

// //     if (!prompt && chatHistory.length === 0) {
// //       throw new Error('Either prompt or chatHistory is required');
// //     }

// //     if (!togetherApiKey) {
// //       throw new Error('Together.ai API key not configured');
// //     }

// //     console.log(`Making request to Together API for model: ${model}, streaming: ${stream}`);
    
// //     // Prepare messages for the chat API
// //     let messages = [];
    
// //     // If chat history is provided, use it directly
// //     if (chatHistory.length > 0) {
// //       messages = chatHistory;
// //     } else {
// //       // Otherwise, create a basic user prompt message
// //       messages = [
// //         {
// //           role: "system",
// //           content: "You are a professional resume coach assisting users with improving their resumes. Be constructive, honest, and professional."
// //         },
// //         {
// //           role: "user",
// //           content: prompt
// //         }
// //       ];
// //     }

// //     // For streaming responses
// //     if (stream) {
// //       console.log('Streaming response from Together API');
      
// //       // Create a new ReadableStream that will be returned to the client
// //       const encoder = new TextEncoder();
// //       const stream = new ReadableStream({
// //         async start(controller) {
// //           try {
// //             // Use the Together client to create a streaming completion
// //             const togetherStream = await together.chat.completions.create({
// //               model,
// //               messages,
// //               max_tokens,
// //               temperature: 0.7,
// //               top_p: 0.8,
// //               stream: true,
// //             });
            
// //             // Process each chunk from the Together stream
// //             for await (const chunk of togetherStream) {
// //               // Format the chunk as an SSE event
// //               const content = chunk.choices?.[0]?.delta?.content || '';
// //               if (content) {
// //                 // Convert the chunk to proper SSE format
// //                 const data = JSON.stringify({
// //                   choices: [{ delta: { content } }]
// //                 });
                
// //                 // Send the chunk to the client
// //                 controller.enqueue(encoder.encode(`data: ${data}\n\n`));
// //               }
// //             }
            
// //             // Signal the end of the stream
// //             controller.enqueue(encoder.encode('data: [DONE]\n\n'));
// //             controller.close();
// //           } catch (error) {
// //             console.error('Error in Together streaming:', error);
// //             controller.error(error);
// //           }
// //         }
// //       });
      
// //       // Return the stream to the client
// //       return new Response(stream, {
// //         headers: {
// //           ...corsHeaders,
// //           'Content-Type': 'text/event-stream',
// //           'Cache-Control': 'no-cache',
// //           'Connection': 'keep-alive'
// //         }
// //       });
// //     }
    
// //     // For non-streaming responses
// //     const response = await together.chat.completions.create({
// //       model,
// //       messages,
// //       max_tokens,
// //       temperature: 0.7,
// //       top_p: 0.8,
// //       stream: false,
// //     });
    
// //     return new Response(JSON.stringify({
// //       success: true,
// //       data: response
// //     }), {
// //       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
// //     });
    
// //   } catch (error) {
// //     console.error('Error in together-ai function:', error);
    
// //     return new Response(JSON.stringify({
// //       success: false,
// //       error: error.message
// //     }), {
// //       status: 500,
// //       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
// //     });
// //   }
// // });
