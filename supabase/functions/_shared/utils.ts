// Export comprehensive CORS headers for use across the application
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};
// Handle OPTIONS preflight requests
export function handleOptions(req) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  return null;
}
/**
 * callGroqAPI
 *  • tries Together.ai first
 *  • then falls back to Groq (compound-beta-mini),
 *  • then finally to Anwan (Meta-Llama-3-8B-Instruct).
 */ export async function callGroqAPI(system, user) {
  const TOGETHER_KEY = Deno.env.get('TOGETHER_API_KEY');
  const GROQ_KEY = Deno.env.get('GROQ');
  const ANWAN_KEY = Deno.env.get('ANWAN');
  if (!TOGETHER_KEY) throw new Error('TOGETHER_API_KEY not found in environment');
  if (!GROQ_KEY) throw new Error('GROQ API key not found in environment');
  if (!ANWAN_KEY) throw new Error('ANWAN API key not found in environment');
  const togetherUrl = 'https://api.together.xyz/v1/completions';
  const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  const anwanUrl = 'https://api.awanllm.com/v1/chat/completions';
  // 1️⃣ Try Together.ai
  let resp = await fetch(togetherUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOGETHER_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      prompt: `${system}\n${user}`,
      max_tokens: 500,
      temperature: 0.7,
      top_p: 0.8,
      top_k: 50
    })
  });
  if (resp.ok) {
    const data = await resp.json();
    // Together.ai returns `choices[0].message.content` or sometimes `choices[0].text`
    return data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text;
  }
  console.error(`Together.ai failed (status ${resp.status}):`, await resp.text());
  // 2️⃣ Fallback to Groq
  resp = await fetch(groqUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'compound-beta-mini',
      messages: [
        {
          role: 'system',
          content: system
        },
        {
          role: 'user',
          content: user
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  if (resp.ok) {
    const json = await resp.json();
    return json.choices?.[0]?.message?.content;
  }
  console.error(`Groq failed (status ${resp.status}):`, await resp.text());
  // 3️⃣ Finally try Anwan
  resp = await fetch(anwanUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANWAN_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'Meta-Llama-3-8B-Instruct',
      messages: [
        {
          role: 'system',
          content: system
        },
        {
          role: 'user',
          content: user
        }
      ],
      temperature: 0.5,
      max_tokens: 500
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`All providers failed — last error: ${resp.status} ${txt}`);
  }
  const an = await resp.json();
  return an.choices?.[0]?.message?.content;
}
// /**
//  * callGroqAPI
//  *  • tries ANWAN (Meta-Llama-3-8B-Instruct) first,
//  *    then falls back to GROQ (compound-beta-mini).
//  *
//  * @param system      System-role instructions (what the assistant "is")
//  * @param user        User-role prompt (what you want it to do)
//  */ export async function callGroqAPI(system, user) {
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
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({
//       model: 'Meta-Llama-3-8B-Instruct',
//       messages: [
//         {
//           role: 'system',
//           content: system
//         },
//         {
//           role: 'user',
//           content: user
//         }
//       ],
//       temperature: 0.5,
//       max_tokens: 1000 //500
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
//           {
//             role: 'system',
//             content: system
//           },
//           {
//             role: 'user',
//             content: user
//           }
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
/**
 * callGroqWithRetry
 *  • wraps callGroqAPI in exponential-backoff retry
 *
 * @param system      System-role instructions
 * @param user        User-role prompt
 * @param attempt     (internal) current retry number
 * @param maxAttempts Maximum retries before giving up
 */ export async function callGroqWithRetry(system, user, attempt = 1, maxAttempts = 4) {
  try {
    console.log(`callGroqWithRetry: Attempt ${attempt}/${maxAttempts}`);
    return await callGroqAPI(system, user);
  } catch (err) {
    if (attempt < maxAttempts) {
      // exponential backoff
      let waitMs = 1000 * Math.pow(2, attempt);
      // if error says "try again in Xs"
      const m = err.message.match(/try again in (\d+\.?\d*)s/i);
      if (m) {
        waitMs = Math.ceil(parseFloat(m[1]) * 1000) + 500;
        console.log(`Extracted wait=${waitMs}ms from error message`);
      }
      // jitter
      waitMs += Math.floor(Math.random() * 500);
      console.log(`Waiting ${waitMs}ms before retry #${attempt + 1}`);
      await new Promise((r)=>setTimeout(r, waitMs));
      return callGroqWithRetry(system, user, attempt + 1, maxAttempts);
    }
    console.error(`Max retry attempts (${maxAttempts}) reached.`);
    throw err;
  }
}
