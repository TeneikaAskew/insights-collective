
// Safe JSON parse with fallback
export function safeJsonParse(jsonString: string, fallback: any): any {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Error parsing JSON:", e);
    return fallback;
  }
}

// Handle API errors consistently
export function handleApiError(error: any, defaultMessage = "An unexpected error occurred"): string {
  if (typeof error === 'string') return error;
  return error?.message || defaultMessage;
}

// Export comprehensive CORS headers for use across the application
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};

// Handle OPTIONS preflight requests
export function handleOptions(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}
// Add this function for retry logic with exponential backoff
// export async function callGroqWithRetry(apiKey, body, maxRetries = 3) {
//   let retryCount = 0;
//   let baseDelay = 1000; // Start with 1 second delay
  
//   while (retryCount <= maxRetries) {
//     try {
//       console.log(`callGroqWithRetry: Attempt ${retryCount + 1}/${maxRetries + 1}`);
      
//       const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${apiKey}`,
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(body)
//       });
      
//       // If successful, return the response
//       if (response.ok) {
//         return await response.json();
//       }
      
//       // If we hit a rate limit (429)
//       if (response.status === 429) {
//         const errorText = await response.text();
//         console.log(`callGroqWithRetry: Rate limit hit (429). Error: ${errorText}`);
        
//         // Try to extract wait time from error message
//         let waitTime = baseDelay * Math.pow(2, retryCount); // Default exponential backoff
        
//         try {
//           // Extract retry time from error message if available
//           const errorJson = JSON.parse(errorText);
//           const waitTimeMatch = errorJson?.error?.message.match(/try again in (\d+)m?(\d+(?:\.\d+)?)s/i);
          
//           if (waitTimeMatch) {
//             const minutes = waitTimeMatch[1] ? parseInt(waitTimeMatch[1], 10) : 0;
//             const seconds = parseFloat(waitTimeMatch[2] || 0);
//             const extractedWaitTime = (minutes * 60 + seconds) * 1000; // Convert to milliseconds
            
//             if (extractedWaitTime > 0) {
//               waitTime = extractedWaitTime + 500; // Add a small buffer (500ms)
//               console.log(`callGroqWithRetry: Extracted wait time of ${waitTime}ms from error message`);
//             }
//           }
//         } catch (e) {
//           console.log(`callGroqWithRetry: Couldn't parse error message for wait time: ${e.message}`);
//         }
        
//         // Wait before retry
//         console.log(`callGroqWithRetry: Waiting ${waitTime}ms before retry ${retryCount + 1}`);
//         await new Promise(resolve => setTimeout(resolve, waitTime));
//         retryCount++;
//         continue;
//       }
      
//       // For other errors, throw and don't retry
//       const errorText = await response.text();
//       throw new Error(`GROQ API error: ${response.status} - ${errorText}`);
      
//     } catch (error) {
//       // If this is a network error or something we can retry
//       if (retryCount < maxRetries && !error.message.includes('GROQ API error:')) {
//         const waitTime = baseDelay * Math.pow(2, retryCount);
//         console.log(`callGroqWithRetry: Error: ${error.message}. Retrying in ${waitTime}ms...`);
//         await new Promise(resolve => setTimeout(resolve, waitTime));
//         retryCount++;
//       } else {
//         // We've exhausted retries or got a non-retryable error
//         throw error;
//       }
//     }
//   }
  
//   throw new Error(`Failed after ${maxRetries} retries`);
// }


// Function to call GROQ API with retry logic
// async function callGroqWithRetry(prompt: string, context: any, attempt = 1, maxAttempts = 4): Promise<any> {
//   try {
//     console.log(`callGroqWithRetry: Attempt ${attempt}/${maxAttempts}`);
    
//     // Call your actual GROQ API here
//     const response = await callGroqAPI(prompt);
    
//     return response;
//   } catch (error: any) {
//     if (attempt < maxAttempts) {
//       // Extract wait time from rate limit error if available
//       let waitTime = 1000 * Math.pow(2, attempt); // Default exponential backoff
      
//       // Check if it's a rate limit error with a specific wait time
//       if (error.message && error.message.includes('rate limit')) {
//         console.log(`callGroqWithRetry: Rate limit hit (429). Error: ${error.message}\n`);
        
//         // Try to extract wait time from error message if provided by API
//         const waitTimeMatch = error.message.match(/try again in (\d+\.?\d*)s/i);
//         if (waitTimeMatch && waitTimeMatch[1]) {
//           const seconds = parseFloat(waitTimeMatch[1]);
//           waitTime = Math.ceil(seconds * 1000);
//           console.log(`callGroqWithRetry: Extracted wait time of ${waitTime}ms from error message`);
//         }
//       } else {
//         console.error(`API error (attempt ${attempt}/${maxAttempts}):`, error);
//       }
      
//       // Add some jitter to avoid synchronized retries
//       waitTime += Math.floor(Math.random() * 500);
      
//       console.log(`callGroqWithRetry: Waiting ${waitTime}ms before retry ${attempt}`);
//       await new Promise(resolve => setTimeout(resolve, waitTime));
      
//       // Recursive retry with incremented attempt counter
//       return callGroqWithRetry(prompt, context, attempt + 1, maxAttempts);
//     } else {
//       // Max attempts reached, throw the error
//       console.error(`Max retry attempts (${maxAttempts}) reached.`);
//       throw error;
//     }
//   }
// }


/**
 * callGroqAPI
 *  • tries ANWAN (Meta‑Llama‑3‑8B‑Instruct) first,
 *    then falls back to GROQ (compound‑beta‑mini).
 */
// Implement your actual GROQ API call here
// export async function callGroqAPI(prompt: string): Promise<any> {
//   // Replace this with your actual API implementation
//   // Example using fetch:
  
//   try {

//     const GROQ_API_KEY = Deno.env.get('GROQ');
//     if (!GROQ_API_KEY) {
//       throw new Error('GROQ API key not found in environment');
//     }
//     const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${GROQ_API_KEY}`
//       },
//       body: JSON.stringify({
//         model: 'compound-beta-mini', //'llama3-8b-8192',
//         messages: [
//           { role: 'user', content: prompt }
//         ],
//         temperature: 0.7,
//         max_tokens: 500
//       })
//     });
    
//     if (!response.ok) {
//       const errorData = await response.json();
//       throw new Error(`GROQ API Error: ${JSON.stringify(errorData)}`);
//     }
    
//     const data = await response.json();
//     return data.choices[0].message.content;
//   } catch (error) {
//     console.error("Error calling GROQ API:", error);
//     throw error;
//   }
// }

// ─────────── new helpers for GROQ/ANWAN ───────────

/**
 * callGroqAPI
 *  • tries ANWAN (Meta‑Llama‑3‑8B‑Instruct) first,
 *    then falls back to GROQ (compound‑beta‑mini).
 */
export async function callGroqAPI(prompt: string): Promise<string> {
  const AWAN_API_KEY = Deno.env.get('AWAN');
  if (!AWAN_API_KEY) throw new Error('AWAN API key not found in environment');
  const GROQ_API_KEY = Deno.env.get('GROQ');
  if (!GROQ_API_KEY) throw new Error('GROQ API key not found in environment');

  const awanUrl = 'https://api.awanllm.com/v1/chat/completions';
  const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

  // 1️⃣ Try ANWAN
  let resp = await fetch(awanUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AWAN_API_KEY}`
    },
    body: JSON.stringify({
      model: 'Meta-Llama-3-8B-Instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  // 2️⃣ On 429 or other error, fall back to GROQ
  if (resp.status === 429 || !resp.ok) {
    console.warn(`ANWAN failed (status ${resp.status}), falling back to GROQ`);
    resp = await fetch(groqUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'compound-beta-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500
      })
    });
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Chat completion failed: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content;
}

/**
 * callGroqWithRetry
 *  • wraps callGroqAPI in exponential‑backoff retry
 */
export async function callGroqWithRetry(
  prompt: string,
  attempt = 1,
  maxAttempts = 4
): Promise<string> {
  try {
    console.log(`callGroqWithRetry: Attempt ${attempt}/${maxAttempts}`);
    return await callGroqAPI(prompt);
  } catch (error: any) {
    if (attempt < maxAttempts) {
      // default backoff
      let waitTime = 1000 * Math.pow(2, attempt);

      // if error mentions “rate limit in …s”
      const m = error.message.match(/try again in (\d+\.?\d*)s/i);
      if (m) {
        waitTime = Math.ceil(parseFloat(m[1]) * 1000) + 500;
        console.log(`Extracted waitTime=${waitTime}ms from error message`);
      }

      // jitter
      waitTime += Math.floor(Math.random() * 500);
      console.log(`Waiting ${waitTime}ms before retry ${attempt + 1}`);
      await new Promise(r => setTimeout(r, waitTime));

      return callGroqWithRetry(prompt, attempt + 1, maxAttempts);
    }

    console.error(`Max retry attempts (${maxAttempts}) reached.`);
    throw error;
  }
}