console.log("Bullet Extractor Endpoint hit")

// bulletImprover.ts

export const config = {
  MAX_BATCHES_TO_PROCESS: 1,
  DEFAULT_BATCH_SIZE: 5,
  MAX_RETRIES: 5,
  RATE_LIMIT_DELAY_MS: 2000,
  RATE_LIMIT_JITTER_MS: 500
};

// This is the primary function that needs to be exported - it's imported in bulletSuggestions.ts
export async function improveBullet(bulletData: any): Promise<any> {
  try {
    console.log(`Improving bullet: ${bulletData.original.substring(0, 30)}...`);
    
    // Make API call to rewrite the bullet
    const groqPrompt = constructGroqPrompt(bulletData);
    const result = await callGroqWithRetry(groqPrompt, bulletData);
    
    // Parse the response to extract the rewritten bullet and tips
    const processedResult = processGroqResponse(result, bulletData);
    
    return processedResult;
  } catch (error) {
    console.error(`Error improving bullet:`, error);
    // Return original bullet and fallback tips if there's an error
    return {
      rewritten: bulletData.original,
      tips: "Consider adding metrics, starting with strong action verbs, and focusing on impact."
    };
  }
}

// Helper function to construct the prompt for GROQ
function constructGroqPrompt(bulletData: any): string {
  // Construct a prompt based on the bullet data
  const prompt = `
  Rewrite this resume bullet point to make it stronger:
  
  Original: ${bulletData.original}
  
  Current scores:
  - Action words: ${bulletData.xyz_scores?.action || 0}/10
  - Measurable results: ${bulletData.xyz_scores?.metrics || 0}/30
  - Clarity/focus: ${bulletData.xyz_scores?.clarity || 0}/10
  - Industry terms: ${bulletData.xyz_scores?.industry || 0}/25
  - Achievement focus: ${bulletData.xyz_scores?.achievement || 0}/25
  
  Word balance:
  - Industry terms: ${bulletData.word_balance?.industry_pct || 0}%
  - Common words: ${bulletData.word_balance?.common_pct || 0}%
  - Action words: ${bulletData.word_balance?.action_pct || 0}%
  - Metrics: ${bulletData.word_balance?.metric_pct || 0}%
  
  Improve this bullet by:
  1. Making it more results-oriented
  2. Using stronger action verbs
  3. Adding specific metrics if missing
  4. Making it more concise and focused
  5. Incorporating relevant industry terms
  
  Respond in JSON format with 'rewritten' and 'tips' only; 'rewritten' for the improved bullet and 'tips' for specific improvement advice.
  `;
  
  return prompt;
}

// Helper function to process the GROQ response
function processGroqResponse(response: any, originalBullet: any): any {
  try {
    // If the response is already in the expected format, return it
    if (response.rewritten && response.tips) {
      return response;
    }
    
    // Try to parse the response if it's a JSON string
    if (typeof response === 'string') {
      try {
        const parsedResponse = JSON.parse(response);
        if (parsedResponse.rewritten && parsedResponse.tips) {
          return parsedResponse;
        }
      } catch (e) {
        // Not valid JSON, continue with other parsing methods
      }
      
      // Try to extract from the string
      const rewrittenMatch = response.match(/["']rewritten["']\s*:\s*["']([^"']+)["']/);
      const tipsMatch = response.match(/["']tips["']\s*:\s*["']([^"']+)["']/);
      
      if (rewrittenMatch && tipsMatch) {
        return {
          rewritten: rewrittenMatch[1],
          tips: tipsMatch[1]
        };
      }
    }
    
    // Fallback: extract any content between opening/closing brackets as the rewritten bullet
    if (typeof response === 'string') {
      const contentBetweenBrackets = response.match(/\[(.*?)\]/s);
      if (contentBetweenBrackets && contentBetweenBrackets[1]) {
        return {
          rewritten: contentBetweenBrackets[1].trim(),
          tips: "Extracted from API response."
        };
      }
    }
    
    // Last resort fallback
    console.warn("Could not parse GROQ response, returning original bullet");
    return {
      rewritten: originalBullet.original,
      tips: "Could not generate specific tips. Consider adding metrics and using stronger action verbs."
    };
  } catch (error) {
    console.error("Error processing GROQ response:", error);
    return {
      rewritten: originalBullet.original,
      tips: "Error processing the API response. Consider adding metrics and using stronger action verbs."
    };
  }
}

// Function to call GROQ API with retry logic
async function callGroqWithRetry(prompt: string, context: any, attempt = 1, maxAttempts = 4): Promise<any> {
  try {
    console.log(`callGroqWithRetry: Attempt ${attempt}/${maxAttempts}`);
    
    // Call your actual GROQ API here
    const response = await callGroqAPI(prompt);
    
    return response;
  } catch (error: any) {
    if (attempt < maxAttempts) {
      // Extract wait time from rate limit error if available
      let waitTime = 1000 * Math.pow(2, attempt); // Default exponential backoff
      
      // Check if it's a rate limit error with a specific wait time
      if (error.message && error.message.includes('rate limit')) {
        console.log(`callGroqWithRetry: Rate limit hit (429). Error: ${error.message}\n`);
        
        // Try to extract wait time from error message if provided by API
        const waitTimeMatch = error.message.match(/try again in (\d+\.?\d*)s/i);
        if (waitTimeMatch && waitTimeMatch[1]) {
          const seconds = parseFloat(waitTimeMatch[1]);
          waitTime = Math.ceil(seconds * 1000);
          console.log(`callGroqWithRetry: Extracted wait time of ${waitTime}ms from error message`);
        }
      } else {
        console.error(`API error (attempt ${attempt}/${maxAttempts}):`, error);
      }
      
      // Add some jitter to avoid synchronized retries
      waitTime += Math.floor(Math.random() * 500);
      
      console.log(`callGroqWithRetry: Waiting ${waitTime}ms before retry ${attempt}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Recursive retry with incremented attempt counter
      return callGroqWithRetry(prompt, context, attempt + 1, maxAttempts);
    } else {
      // Max attempts reached, throw the error
      console.error(`Max retry attempts (${maxAttempts}) reached.`);
      throw error;
    }
  }
}

// Implement your actual GROQ API call here
// async function callGroqAPI(prompt: string): Promise<any> {
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


async function callGroqAPI(prompt: string): Promise<string> {
  const GROQ_API_KEY = Deno.env.get('GROQ');
  if (!GROQ_API_KEY) throw new Error('GROQ API key not found in environment');
  const AWAN_API_KEY = Deno.env.get('AWAN');
  if (!AWAN_API_KEY) throw new Error('AWAN API key not found in environment');

  const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  const awanUrl = 'https://api.awanllm.com/v1/chat/completions';

  // 1️⃣ Try GROQ first
  let resp = await fetch(groqUrl, {
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

  // 2️⃣ On 429, fall back to AWAN with the correct model name
  if (resp.status === 429) {
    console.warn('GROQ rate limit, falling back to AWAN');
    resp = await fetch(awanUrl, {
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
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Chat completion failed: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content;
}

// Function to process a batch of bullets
export async function processBatchQueue(batchQueue: any[], userId: string) {
  try {
    console.log(`Starting background bullet improvement for userId: ${userId}`);
    
    // Track processed batches
    let processedBatchCount = 0;
    let results = [];
    
    // Process batches up to the limit
    for (let i = 0; i < Math.min(batchQueue.length, config.MAX_BATCHES_TO_PROCESS); i++) {
      const batch = batchQueue[i];
      processedBatchCount++;
      
      console.log(`Processing batch ${processedBatchCount} of ${config.MAX_BATCHES_TO_PROCESS}: ${batch.length} bullets from queue`);
      
      // Rate limiting with jitter to avoid synchronized retries
      if (i > 0) {
        const jitter = Math.floor(Math.random() * config.RATE_LIMIT_JITTER_MS);
        const delay = config.RATE_LIMIT_DELAY_MS + jitter;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      try {
        const batchResults = await improveBulletsBatch(batch, userId);
        results = [...results, ...batchResults];
      } catch (error) {
        console.error(`Error processing batch ${i+1}:`, error);
        // Add original bullets as fallback
        const fallbackResults = batch.map((bullet: any) => ({
          id: bullet.id,
          rewritten: bullet.original,
          error: true
        }));
        results = [...results, ...fallbackResults];
      }
    }
    
    // Handle any remaining bullets outside the batch limit
    if (processedBatchCount < batchQueue.length) {
      const remainingBullets = batchQueue.slice(processedBatchCount).flat();
      console.log(`Batch limit of ${config.MAX_BATCHES_TO_PROCESS} reached. Resolving ${remainingBullets.length} remaining bullets with defaults.`);
      
      // Add original bullets for all remaining
      const defaultResults = remainingBullets.map((bullet: any) => ({
        id: bullet.id,
        rewritten: bullet.original,
        unprocessed: true
      }));
      
      results = [...results, ...defaultResults];
    }
    
    return results;
  } catch (error) {
    console.error('Error in processBatchQueue:', error);
    throw error;
  }
}

// Function to improve a batch of bullets
export async function improveBulletsBatch(bullets: any[], userId: string) {
  const results = [];
  
  for (const bullet of bullets) {
    console.log(`Improving bullet: ${bullet.original.substring(0, 30)}...`);
    console.log(`Beginning rewrite of bullet points`);
    
    try {
      // Use the single bullet improvement function
      const result = await improveBullet(bullet);
      
      results.push({
        id: bullet.id,
        rewritten: result.rewritten
      });
    } catch (err) {
      console.error(`Error improving bullet ${bullet.id}:`, err);
      results.push({
        id: bullet.id,
        rewritten: bullet.original,
        error: true
      });
    }
  }
  
  return results;
}

// Batch creation utility
export function getBatchSize(totalItems: number): number {
  return config.DEFAULT_BATCH_SIZE;
}

// Create batches from a list of items
export function createBatches(items: any[], batchSize: number): any[][] {
  const batches = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  return batches;
}