
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


// This function sets up Supabase client with service role key credentials from env
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
// ─────────── new helpers for GROQ/ANWAN ───────────

/**
 * callGroqAPI
 *  • tries ANWAN (Meta-Llama-3-8B-Instruct) first,
 *    then falls back to GROQ (compound-beta-mini).
 *
 * @param system      System-role instructions (what the assistant “is”)
 * @param user        User-role prompt (what you want it to do)
 */
export async function callGroqAPI(
  system: string,
  user: string
): Promise<string> {
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
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  // 2️⃣ On 429 or error → fallback to GROQ
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
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user   }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });
  }

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Chat completion failed: ${resp.status} ${txt}`);
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content;
}

/**
 * callGroqWithRetry
 *  • wraps callGroqAPI in exponential-backoff retry
 *
 * @param system      System-role instructions
 * @param user        User-role prompt
 * @param attempt     (internal) current retry number
 * @param maxAttempts Maximum retries before giving up
 */
export async function callGroqWithRetry(
  system: string,
  user: string,
  attempt = 1,
  maxAttempts = 4
): Promise<string> {
  try {
    console.log(`callGroqWithRetry: Attempt ${attempt}/${maxAttempts}`);
    return await callGroqAPI(system, user);
  } catch (err: any) {
    if (attempt < maxAttempts) {
      // exponential backoff
      let waitMs = 1000 * Math.pow(2, attempt);

      // if error says “try again in Xs”
      const m = err.message.match(/try again in (\d+\.?\d*)s/i);
      if (m) {
        waitMs = Math.ceil(parseFloat(m[1]) * 1000) + 500;
        console.log(`Extracted wait=${waitMs}ms from error message`);
      }

      // jitter
      waitMs += Math.floor(Math.random() * 500);
      console.log(`Waiting ${waitMs}ms before retry #${attempt+1}`);
      await new Promise(r => setTimeout(r, waitMs));

      return callGroqWithRetry(system, user, attempt + 1, maxAttempts);
    }

    console.error(`Max retry attempts (${maxAttempts}) reached.`);
    throw err;
  }
}
