
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Utility function to call LLM with retry logic
export async function callLLMWithRetry(system, user, maxAttempts = 3) {
  const GROQ = Deno.env.get('GROQ');
  if (!GROQ) throw new Error('GROQ API key not found');
  
  let attempt = 0;
  let lastError;
  
  while (attempt < maxAttempts) {
    try {
      attempt++;
      console.log(`Attempt ${attempt} of ${maxAttempts}`);
      
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ],
          temperature: 0.7,
          max_tokens: 750
        })
      });
      
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`API error: ${resp.status}, ${errorText}`);
      }
      
      const result = await resp.json();
      return result.choices[0].message.content.trim();
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err);
      lastError = err;
      
      // Wait with exponential backoff before retrying
      if (attempt < maxAttempts) {
        const delay = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s...
        console.log(`Waiting ${delay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('All LLM call attempts failed');
}
