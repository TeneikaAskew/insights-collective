// This function sets up Supabase client with service role key credentials from env
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !supabaseKey) {
    console.error('getSupabaseClient: Missing Supabase credentials in environment variables!');
    throw new Error('Missing Supabase credentials');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export const supabase = getSupabaseClient();

// Track failed endpoints globally - persist across function calls
// This will keep track of how many times each endpoint has failed
const failedEndpoints: Record<string, number> = {
  ANWAN: 0,
  GROQ: 0,
  TOGETHER: 0
};

// Maximum failures before skipping an endpoint
const MAX_FAILURES = 4;

// Function to check if an endpoint should be skipped
function shouldSkipEndpoint(endpoint: string): boolean {
  return (failedEndpoints[endpoint] || 0) >= MAX_FAILURES;
}

// Function to record a failure for an endpoint
function recordEndpointFailure(endpoint: string): void {
  failedEndpoints[endpoint] = (failedEndpoints[endpoint] || 0) + 1;
  console.log(`${endpoint} failure count: ${failedEndpoints[endpoint]}/${MAX_FAILURES}`);
}

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

// ─────────── new helpers for GROQ/ANWAN/TOGETHER ───────────

/**
 * callLLMAPI
 * • tries available endpoints in order based on their failure status
 * • skips endpoints that have failed more than MAX_FAILURES times
 *
 * @param system      System-role instructions (what the assistant "is")
 * @param user        User-role prompt (what you want it to do)
 */
export async function callLLMAPI(
  system: string,
  user: string
): Promise<string> {
  // Try endpoints in order of preference, skipping any that have exceeded failure threshold
  if (!shouldSkipEndpoint('ANWAN')) {
    try {
      return await callANWANAPI(system, user);
    } catch (error) {
      console.error('ANWAN API failed:', error.message);
      // Only increment failure counter for rate limits or serious errors
      if (error.status === 429 || error.status >= 500) {
        recordEndpointFailure('ANWAN');
      }
    }
  }

  if (!shouldSkipEndpoint('GROQ')) {
    try {
      return await callGROQAPI(system, user);
    } catch (error) {
      console.error('GROQ API failed:', error.message);
      if (error.status === 429 || error.status >= 500) {
        recordEndpointFailure('GROQ');
      }
    }
  }

  if (!shouldSkipEndpoint('TOGETHER')) {
    try {
      return await callTOGETHERAPI(system, user);
    } catch (error) {
      console.error('TOGETHER API failed:', error.message);
      if (error.status === 429 || error.status >= 500) {
        recordEndpointFailure('TOGETHER');
      }
    }
  }

  // If we reached here, all viable endpoints failed
  throw new Error('All LLM endpoints failed or are disabled due to past failures');
}

// ANWAN API call
async function callANWANAPI(system: string, user: string): Promise<string> {
  const ANWAN_API_KEY = Deno.env.get('ANWAN');
  if (!ANWAN_API_KEY) throw new Error('ANWAN API key not found in environment');

  const anwanUrl = 'https://api.awanllm.com/v1/chat/completions';
  
  const resp = await fetch(anwanUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANWAN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'Meta-Llama-3-8B-Instruct',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    const error = new Error(`ANWAN API failed: ${resp.status} ${txt}`);
    // @ts-ignore - Adding status property to Error object
    error.status = resp.status;
    throw error;
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content;
}

// GROQ API call
async function callGROQAPI(system: string, user: string): Promise<string> {
  const GROQ_API_KEY = Deno.env.get('GROQ');
  if (!GROQ_API_KEY) throw new Error('GROQ API key not found in environment');

  const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  
  const resp = await fetch(groqUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'compound-beta-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    const error = new Error(`GROQ API failed: ${resp.status} ${txt}`);
    // @ts-ignore - Adding status property to Error object
    error.status = resp.status;
    throw error;
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content;
}

// TOGETHER API call
async function callTOGETHERAPI(system: string, user: string): Promise<string> {
  const TOGETHER_API_KEY = Deno.env.get('TOGETHER');
  if (!TOGETHER_API_KEY) throw new Error('TOGETHER API key not found in environment');

  const togetherUrl = 'https://api.together.xyz/v1/chat/completions';
  
  const resp = await fetch(togetherUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOGETHER_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    const error = new Error(`TOGETHER API failed: ${resp.status} ${txt}`);
    // @ts-ignore - Adding status property to Error object
    error.status = resp.status;
    throw error;
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content;
}

/**
 * callLLMWithRetry
 * • wraps callLLMAPI in exponential-backoff retry
 *
 * @param system      System-role instructions
 * @param user        User-role prompt
 * @param attempt     (internal) current retry number
 * @param maxAttempts Maximum retries before giving up
 */
export async function callLLMWithRetry(
  system: string,
  user: string,
  attempt = 1,
  maxAttempts = 4
): Promise<string> {
  try {
    console.log(`callLLMWithRetry: Attempt ${attempt}/${maxAttempts}`);
    return await callLLMAPI(system, user);
  } catch (err: any) {
    if (attempt < maxAttempts) {
      // exponential backoff
      let waitMs = 1000 * Math.pow(2, attempt);

      // if error says "try again in Xs"
      const m = err.message.match(/try again in (\d+.?\d*)s/i);
      if (m) {
        waitMs = Math.ceil(parseFloat(m[1]) * 1000) + 500;
        console.log(`Extracted wait=${waitMs}ms from error message`);
      }

      // jitter
      waitMs += Math.floor(Math.random() * 500);
      console.log(`Waiting ${waitMs}ms before retry #${attempt+1}`);
      await new Promise(r => setTimeout(r, waitMs));

      return callLLMWithRetry(system, user, attempt + 1, maxAttempts);
    }

    console.error(`Max retry attempts (${maxAttempts}) reached.`);
    throw err;
  }
}

// Function to reset failure counts (useful for testing or manual resets)
export function resetEndpointFailures(): void {
  Object.keys(failedEndpoints).forEach(key => {
    failedEndpoints[key] = 0;
  });
  console.log('All endpoint failure counts have been reset');
}
// // This function sets up Supabase client with service role key credentials from env
// import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
// function getSupabaseClient() {
//   const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
//   const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
//   if (!supabaseUrl || !supabaseKey) {
//     console.error('getSupabaseClient: Missing Supabase credentials in environment variables!');
//     throw new Error('Missing Supabase credentials');
//   }
//   return createClient(supabaseUrl, supabaseKey);
// }
// export const supabase = getSupabaseClient();

// // Safe JSON parse with fallback
// export function safeJsonParse(jsonString: string, fallback: any): any {
//   try {
//     return JSON.parse(jsonString);
//   } catch (e) {
//     console.error("Error parsing JSON:", e);
//     return fallback;
//   }
// }

// // Handle API errors consistently
// export function handleApiError(error: any, defaultMessage = "An unexpected error occurred"): string {
//   if (typeof error === 'string') return error;
//   return error?.message || defaultMessage;
// }

// // Export comprehensive CORS headers for use across the application
// export const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
//   'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
//   'Access-Control-Allow-Credentials': 'true',
//   'Access-Control-Max-Age': '86400'
// };

// // Handle OPTIONS preflight requests
// export function handleOptions(req: Request) {
//   if (req.method === 'OPTIONS') {
//     return new Response('ok', { headers: corsHeaders });
//   }
//   return null;
// }



// // ─────────── new helpers for GROQ/ANWAN ───────────

// /**
//  * callGroqAPI
//  *  • tries ANWAN (Meta-Llama-3-8B-Instruct) first,
//  *    then falls back to GROQ (compound-beta-mini).
//  *
//  * @param system      System-role instructions (what the assistant “is”)
//  * @param user        User-role prompt (what you want it to do)
//  */
// export async function callGroqAPI(
//   system: string,
//   user: string
// ): Promise<string> {
//   const ANWAN_API_KEY = Deno.env.get('ANWAN');
//   if (!ANWAN_API_KEY) throw new Error('ANWAN API key not found in environment');
//   const GROQ_API_KEY = Deno.env.get('GROQ');
//   if (!GROQ_API_KEY) throw new Error('GROQ API key not found in environment');

//   const anwanUrl = 'https://api.awanllm.com/v1/chat/completions';
//   const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';

//   // 1️⃣ Try ANWAN
//   let resp = await fetch(anwanUrl, {
//     method: 'POST',
//     headers: {
//       'Authorization': `Bearer ${ANWAN_API_KEY}`,
//         'Content-Type': 'application/json'
      
//     },
//     body: JSON.stringify({
//       model: 'Meta-Llama-3-8B-Instruct',
//       messages: [
//         { role: 'system', content: system },
//         { role: 'user',   content: user   }
//       ],
//       temperature: 0.7,
//       max_tokens: 500
//     })
//   });

//   // 2️⃣ On 429 or error → fallback to GROQ
//   if (resp.status === 429 || !resp.ok) {
//     // console.warn(`ANWAN failed (status ${resp.status}), falling back to GROQ`);
//     const body = await resp.text();
//     console.error(`Switching to GROQ API -ANWAN failed (status ${resp.status} – body: ${body})`);
//     resp = await fetch(groqUrl, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${GROQ_API_KEY}`
//       },
//       body: JSON.stringify({
//         model: 'compound-beta-mini',
//         messages: [
//           { role: 'system', content: system },
//           { role: 'user',   content: user   }
//         ],
//         temperature: 0.7,
//         max_tokens: 500
//       })
//     });
//   }

//   if (!resp.ok) {
//     const txt = await resp.text();
//     throw new Error(`Chat completion failed: ${resp.status} ${txt}`);
//   }

//   const json = await resp.json();
//   return json.choices?.[0]?.message?.content;
// }

// /**
//  * callGroqWithRetry
//  *  • wraps callGroqAPI in exponential-backoff retry
//  *
//  * @param system      System-role instructions
//  * @param user        User-role prompt
//  * @param attempt     (internal) current retry number
//  * @param maxAttempts Maximum retries before giving up
//  */
// export async function callGroqWithRetry(
//   system: string,
//   user: string,
//   attempt = 1,
//   maxAttempts = 4
// ): Promise<string> {
//   try {
//     console.log(`callGroqWithRetry: Attempt ${attempt}/${maxAttempts}`);
//     return await callGroqAPI(system, user);
//   } catch (err: any) {
//     if (attempt < maxAttempts) {
//       // exponential backoff
//       let waitMs = 1000 * Math.pow(2, attempt);

//       // if error says “try again in Xs”
//       const m = err.message.match(/try again in (\d+\.?\d*)s/i);
//       if (m) {
//         waitMs = Math.ceil(parseFloat(m[1]) * 1000) + 500;
//         console.log(`Extracted wait=${waitMs}ms from error message`);
//       }

//       // jitter
//       waitMs += Math.floor(Math.random() * 500);
//       console.log(`Waiting ${waitMs}ms before retry #${attempt+1}`);
//       await new Promise(r => setTimeout(r, waitMs));

//       return callGroqWithRetry(system, user, attempt + 1, maxAttempts);
//     }

//     console.error(`Max retry attempts (${maxAttempts}) reached.`);
//     throw err;
//   }
// }
