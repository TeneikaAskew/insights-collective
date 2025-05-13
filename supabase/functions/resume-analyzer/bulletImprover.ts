console.log("Bullet Extractor Endpoint hit")
import { callLLMWithRetry } from './utils.ts';


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

    
    const result = await callLLMWithRetry("", groqPrompt);
    
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

  Store the improved bullet in 'rewritten' and any tips used to improve it in 'tips'
  
  Respond in JSON format with 'rewritten' and 'tips' only; 
  'rewritten' for the improved bullet point/sentence and 
  'tips' for the specific improvement advice.
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



// const config = {
//   // Maximum number of batches to process
//   MAX_BATCHES_TO_PROCESS: 2,
//   // Default batch size
//   DEFAULT_BATCH_SIZE: 7,
//   // Retry settings
//   MAX_RETRIES: 5,
//   // Rate limiting
//   RATE_LIMIT_DELAY_MS: 2000, // Base delay between batches
//   RATE_LIMIT_JITTER_MS: 500  // Random jitter to add to delay
// };

// async function processBatchQueue(batchQueue, userId) {
//   try {
//     console.log(`Starting background bullet improvement for userId: ${userId}`);
    
//     // Track processed batches
//     let processedBatchCount = 0;
//     let results = [];
    
//     // Calculate total bullets
//     const totalBullets = batchQueue.flat().length;
//     let processedBullets = 0;
    
//     // Process batches up to the limit
//     for (let i = 0; i < Math.min(batchQueue.length, config.MAX_BATCHES_TO_PROCESS); i++) {
//       const batch = batchQueue[i];
//       processedBatchCount++;
      
//       console.log(`Processing batch ${processedBatchCount} of ${config.MAX_BATCHES_TO_PROCESS}: ${batch.length} bullets from queue`);
      
//       // Rate limiting with jitter to avoid synchronized retries
//       if (i > 0) {
//         const jitter = Math.floor(Math.random() * config.RATE_LIMIT_JITTER_MS);
//         const delay = config.RATE_LIMIT_DELAY_MS + jitter;
//         await new Promise(resolve => setTimeout(resolve, delay));
//       }
      
//       try {
//         const batchResults = await improveBulletsBatch(batch, userId);
//         results = [...results, ...batchResults];
//         processedBullets += batch.length;
//       } catch (error) {
//         console.error(`Error processing batch ${i+1}:`, error);
//         // Add original bullets as fallback
//         const fallbackResults = batch.map(bullet => ({
//           id: bullet.id,
//           rewritten: bullet.original, // Use original as fallback
//           error: true
//         }));
//         results = [...results, ...fallbackResults];
//         processedBullets += batch.length;
//       }
//     }
    
//     // Handle any remaining bullets outside the batch limit
//     if (processedBatchCount < batchQueue.length) {
//       const remainingBullets = batchQueue.slice(processedBatchCount).flat();
//       console.log(`Batch limit of ${config.MAX_BATCHES_TO_PROCESS} reached. Resolving ${remainingBullets.length} remaining bullets with defaults.`);
      
//       // Add original bullets for all remaining
//       const defaultResults = remainingBullets.map(bullet => ({
//         id: bullet.id,
//         rewritten: bullet.original, // Return original for unprocessed bullets
//         unprocessed: true
//       }));
      
//       results = [...results, ...defaultResults];
//     }
    
//     return results;
//   } catch (error) {
//     console.error('Error in processBatchQueue:', error);
//     throw error;
//   }
// }

// async function improveBulletsBatch(bullets, userId) {
//   const results = [];
  
//   for (const bullet of bullets) {
//     console.log(`Improving bullet: ${bullet.original.substring(0, 30)}...`);
//     console.log(`Beginning rewrite of bullet points`);
    
//     try {
//       // Implement exponential backoff for retries
//       let attempt = 0;
//       let success = false;
//       let error;
//       let result;
      
//       while (attempt < config.MAX_RETRIES && !success) {
//         try {
//           // Call your AI service with the bullet
//           result = await callLLMWithRetry(bullet.original, userId);
//           success = true;
//         } catch (err) {
//           error = err;
//           attempt++;
          
//           if (attempt < config.MAX_RETRIES) {
//             // Exponential backoff with jitter
//             const backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
//             console.log(`Retry ${attempt}/${config.MAX_RETRIES} after ${backoffTime}ms`);
//             await new Promise(resolve => setTimeout(resolve, backoffTime));
//           }
//         }
//       }
      
//       if (success) {
//         results.push({
//           id: bullet.id,
//           rewritten: result
//         });
//       } else {
//         console.error(`Failed to improve bullet after ${config.MAX_RETRIES} attempts:`, error);
//         results.push({
//           id: bullet.id,
//           rewritten: bullet.original, // Fallback to original
//           error: true
//         });
//       }
//     } catch (err) {
//       console.error(`Error improving bullet ${bullet.id}:`, err);
//       results.push({
//         id: bullet.id,
//         rewritten: bullet.original, // Fallback to original
//         error: true
//       });
//     }
//   }
  
//   return results;
// }

// console.log("Bullet Extractor Endpoint hit")
// import { corsHeaders, callLLMWithRetry } from './utils.ts';
// import { extractSentencesFromResponse } from './sentenceDetector.ts';

// // Global batch queue for bullet processing
// if (!globalThis.bulletBatchQueue) {
//   globalThis.bulletBatchQueue = [];
//   globalThis.batchInProgress = false;
//   globalThis.pendingResults = new Map();
//   globalThis.processingInterval = null;
// }

// // Configuration for batch processing
// const config = {
//   // Maximum number of batches to process - can be changed later
//   MAX_BATCHES_TO_PROCESS: 2,
//   // Default batch size
//   DEFAULT_BATCH_SIZE: 7
// };

// // Service handler for batch bullet improvement
// export function serveBulletImprover() {
//   return async (req) => {
//     try {
//       const data = await req.json();
//       if (!data.bullets || !Array.isArray(data.bullets) || data.bullets.length === 0) {
//         return new Response(JSON.stringify({
//           error: "Missing or invalid bullets array"
//         }), {
//           status: 400,
//           headers: {
//             "Content-Type": "application/json",
//             ...corsHeaders
//           }
//         });
//       }
//       // Validate each bullet has an ID and original text
//       const invalidBullet = data.bullets.find((b) => !b.id || !b.original || typeof b.original !== 'string');
//       if (invalidBullet) {
//         return new Response(JSON.stringify({
//           error: "Each bullet must have an id and original text",
//           invalidBullet
//         }), {
//           status: 400,
//           headers: {
//             "Content-Type": "application/json",
//             ...corsHeaders
//           }
//         });
//       }

//       // console.log("Beginning improvement of bullet points")
//       const improved = await improveBulletsBatch(data);
//       return new Response(JSON.stringify(improved), {
//         headers: {
//           "Content-Type": "application/json",
//           ...corsHeaders
//         }
//       });
//     } catch (error) {
//       console.error("Error in batch bullet improver service:", error);
//       return new Response(JSON.stringify({
//         error: error.message || "Failed to improve bullets in batch"
//       }), {
//         status: 500,
//         headers: {
//           "Content-Type": "application/json",
//           ...corsHeaders
//         }
//       });
//     }
//   };
// }

// /**
//  * Top‐level batch processor: splits bullets into batches, processes sequentially,
//  * and aggregates results. Honors configurable batch size and adds backoff between.
//  */
// export async function improveBulletsBatch(
//   data: { bullets: any[]; batchSize?: number }
// ): Promise<Array<{ id: string; rewritten: string; tips: string }>> {
//   const GROQ_API_KEY = Deno.env.get('GROQ');
//   if (!GROQ_API_KEY) {
//     console.warn('No GROQ key, returning originals');
//     return data.bullets.map((b) => ({ id: b.id, rewritten: b.original, tips: 'No API key configured.' }));
//   }

//   const size = data.batchSize ?? getBatchSize();
//   const chunks = chunkArray(data.bullets, size);
  
//   // Limit the number of batches to process based on configuration
//   const batchesToProcess = Math.min(chunks.length, config.MAX_BATCHES_TO_PROCESS);
  
//   console.log(`Splitting ${data.bullets.length} bullets into ${chunks.length} batches of up to ${size}`);
//   console.log(`Processing only the first ${batchesToProcess} of ${chunks.length} batches`);

//   const allResults: any[] = [];
//   for (let i = 0; i < batchesToProcess; i++) {
//     if (i > 0) await new Promise((r) => setTimeout(r, 2000));
//     console.log(`Processing batch ${i+1}/${batchesToProcess}`);
//     try {
//       const batchRes = await processBatch(chunks[i], GROQ_API_KEY);
//       allResults.push(...batchRes);
//     } catch (e) {
//       console.error('Batch failed:', e);
//       // fallback: identity map for that chunk
//       const fallback = chunks[i].map((b) => ({ id: b.id, rewritten: b.original, tips: 'Failed—please retry.' }));
//       allResults.push(...fallback);
//     }
//   }
  
//   // For any remaining bullets beyond the processed batches, add identity mappings
//   if (batchesToProcess < chunks.length) {
//     console.log(`Adding identity mappings for ${chunks.length - batchesToProcess} unprocessed batches`);
//     for (let i = batchesToProcess; i < chunks.length; i++) {
//       const fallbackBatch = chunks[i].map((b) => ({ 
//         id: b.id, 
//         rewritten: b.original, 
//         tips: 'Batch limit reached. Try adding specific metrics and starting with a strong action verb.' 
//       }));
//       allResults.push(...fallbackBatch);
//     }
//   }

//   return allResults;
// }


// // Single bullet improvement API - adds to queue
// export async function improveBullet(data) {
//   const { original, xyz_scores = {}, word_balance_score = 0, word_balance = {} } = data;
  
//   // Generate a unique ID for this bullet
//   const id = `single_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
//   // Create a promise that will be resolved when processing is complete
//   const resultPromise = new Promise((resolve) => {
//     // Add to the queue with its resolver
//     globalThis.pendingResults.set(id, resolve);
    
//     // Add to the batch queue
//     globalThis.bulletBatchQueue.push({
//       id,
//       original,
//       xyz_scores,
//       word_balance_score,
//       word_balance
//     });
    
//     // Start batch processing if not already running
//     ensureBatchProcessing();
//   });
  
//   // Wait for this bullet to be processed
//   const result = await resultPromise;
  
//   return {
//     rewritten: result.rewritten,
//     tips: result.tips
//   };
// }

// // Make sure batch processing is running
// function ensureBatchProcessing() {
//   // If processing is already in progress or there's no queue, do nothing
//   if (globalThis.batchInProgress || globalThis.bulletBatchQueue.length === 0) {
//     return;
//   }
  
//   // Start batch processing
//   processBatchQueue();
// }

// // Process the queued bullets in batches
// async function processBatchQueue() {
//   // Set the flag to prevent multiple concurrent processing
//   globalThis.batchInProgress = true;
  
//   try {
//     // Track how many batches have been processed
//     let batchesProcessed = 0;
    
//     while (globalThis.bulletBatchQueue.length > 0 && batchesProcessed < config.MAX_BATCHES_TO_PROCESS) {
//       // Wait for a batch to accumulate or process what we have after a timeout
//       if (globalThis.bulletBatchQueue.length < config.DEFAULT_BATCH_SIZE) {
//         // Wait a bit to see if more bullets arrive to form a complete batch
//         await new Promise(resolve => setTimeout(resolve, 500));
//       }
      
//       // Process current batch (up to DEFAULT_BATCH_SIZE bullets)
//       const batchSize = Math.min(config.DEFAULT_BATCH_SIZE, globalThis.bulletBatchQueue.length);
//       if (batchSize === 0) break; // No bullets to process
      
//       // Get the next batch of bullets
//       const bulletBatch = globalThis.bulletBatchQueue.splice(0, batchSize);
//       console.log(`Processing batch ${batchesProcessed + 1} of ${config.MAX_BATCHES_TO_PROCESS}: ${bulletBatch.length} bullets from queue`);
      
//       // Get the GROQ API key
//       const GROQ_API_KEY = Deno.env.get('GROQ');
//       if (!GROQ_API_KEY) {
//         throw new Error("GROQ API key not configured");
//       }
      
//       try {
//         // Process this batch
//         const results = await processBatch(bulletBatch, GROQ_API_KEY);
        
//         // Resolve promises for each processed bullet
//         for (const result of results) {
//           const resolve = globalThis.pendingResults.get(result.id);
//           if (resolve) {
//             resolve(result);
//             globalThis.pendingResults.delete(result.id);
//           }
//         }
//       } catch (error) {
//         console.error("Error processing bullet batch:", error);
        
//         // On error, resolve all promises in this batch with fallback results
//         for (const bullet of bulletBatch) {
//           const resolve = globalThis.pendingResults.get(bullet.id);
//           if (resolve) {
//             resolve({
//               id: bullet.id,
//               original: bullet.original,
//               rewritten: bullet.original,
//               tips: "Service error. Try adding specific metrics and starting with a strong action verb."
//             });
//             globalThis.pendingResults.delete(bullet.id);
//           }
//         }
//       }
      
//       // Increment the number of batches processed
//       batchesProcessed++;
      
//       // Respect rate limits - wait between batches
//       if (globalThis.bulletBatchQueue.length > 0 && batchesProcessed < config.MAX_BATCHES_TO_PROCESS) {
//         await new Promise(resolve => setTimeout(resolve, 2000));
//       }
//     }
    
//     // Handle any remaining bullets in the queue if we've reached the batch limit
//     if (globalThis.bulletBatchQueue.length > 0 && batchesProcessed >= config.MAX_BATCHES_TO_PROCESS) {
//       console.log(`Batch limit of ${config.MAX_BATCHES_TO_PROCESS} reached. Resolving ${globalThis.bulletBatchQueue.length} remaining bullets with defaults.`);
      
//       // Resolve all remaining bullets with default responses
//       for (const bullet of globalThis.bulletBatchQueue) {
//         const resolve = globalThis.pendingResults.get(bullet.id);
//         if (resolve) {
//           resolve({
//             id: bullet.id,
//             original: bullet.original,
//             rewritten: bullet.original,
//             tips: "Batch limit reached. Try adding specific metrics and starting with a strong action verb."
//           });
//           globalThis.pendingResults.delete(bullet.id);
//         }
//       }
      
//       // Clear the queue
//       globalThis.bulletBatchQueue = [];
//     }
//   } catch (error) {
//     console.error("Fatal error in batch queue processing:", error);
    
//     // Resolve all remaining pending promises with default responses
//     for (const [id, resolve] of globalThis.pendingResults.entries()) {
//       // Find the original bullet in the queue
//       const bullet = globalThis.bulletBatchQueue.find(b => b.id === id);
//       if (bullet) {
//         resolve({
//           id,
//           original: bullet.original,
//           rewritten: bullet.original,
//           tips: "Service error. Try adding specific metrics and starting with a strong action verb."
//         });
//       }
//       globalThis.pendingResults.delete(id);
//     }
    
//     // Clear the queue
//     globalThis.bulletBatchQueue = [];
//   } finally {
//     // Reset the processing flag
//     globalThis.batchInProgress = false;
    
//     // If there are still bullets in the queue, restart processing
//     if (globalThis.bulletBatchQueue.length > 0) {
//       processBatchQueue();
//     }
//   }
// }


// /**
//  * Process a single batch of bullets against GROQ API, with robust JSON parsing.
//  */
// export async function processBatch(
//   bullets: Array<{ id: string; original: string; xyz_scores?: any; word_balance_score?: number; word_balance?: any }>,
//   apiKey: string
// ): Promise<Array<{ id: string; rewritten: string; tips: string }>> {
//   const systemPrompt = `You are a professional resume bullet point improver. Your job is to:
// 1. Rewrite each given bullet point to be more impactful
// 2. Start with strong action verbs
// 3. Include quantifiable metrics where possible
// 4. Ensure clarity and conciseness (20-25 words max)
// 5. Incorporate relevant technical or leadership skills

// IMPORTANT: Return ONLY a JSON array of objects with { id, rewritten, tips }.`;

//   // build user prompt
//   let userPrompt = 'Improve the following resume bullet points:';
//   bullets.forEach((b, i) => {
//     userPrompt += `\n\n[${i + 1}] ID: ${b.id}\nOriginal: "${b.original}"`;
//   });

//   const body = JSON.stringify({
//     model: 'llama3-8b-8192',
//     messages: [
//       { role: 'system', content: systemPrompt },
//       { role: 'user', content: userPrompt },
//     ],
//     temperature: 0.3,
//     max_tokens: Math.min(2048, 512 * bullets.length),
//   });

//   const res = await fetchWithRetry(
//     'https://api.groq.com/openai/v1/chat/completions',
//     {
//       method: 'POST',
//       headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
//       body,
//     }
//   );

//   if (!res.ok) {
//     const errText = await res.text();
//     console.error('GROQ API error:', errText);
//     throw new Error(`GROQ API error: ${res.status}`);
//   }

//   const data = await res.json();
//   const content = data.choices?.[0]?.message?.content || '[]';
//   console.log('GROQ response:', content.substring(0, 200));

//   // try robust parsing strategies
//   let parsed: any[] = [];
//   try {
//     parsed = parseGroqJsonResponse(content, bullets);
//   } catch {
//     try {
//       const arr = extractSentencesFromResponse(content);
//       parsed = arr.map((s) => JSON.parse(s));
//     } catch (e) {
//       console.warn('Both parsers failed, defaulting to identity map');
//     }
//   }

//   if (!parsed.length) {
//     return bullets.map((b) => ({ id: b.id, rewritten: b.original, tips: 'Service error—please retry.' }));
//   }

//   return parsed;
// }

// /**
//  * Helper that wraps fetch and retries on 429 response with exponential backoff.
//  */
// async function fetchWithRetry(
//   url: string,
//   options: RequestInit,
//   maxRetries = 5,
//   initialDelay = 1000
// ): Promise<Response> {
//   let attempt = 0;
//   let delay = initialDelay;

//   while (true) {
//     const res = await fetch(url, options);
//     if (res.status !== 429) {
//       return res;
//     }

//     if (attempt >= maxRetries) {
//       throw new Error(`Rate limit exceeded after ${maxRetries + 1} attempts`);
//     }

//     // honor Retry-After header if present
//     const retryAfter = res.headers.get('Retry-After');
//     const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;

//     console.warn(`429 received, retrying in ${wait}ms (attempt ${attempt + 1}/${maxRetries})`);
//     await new Promise((r) => setTimeout(r, wait));

//     attempt++;
//     delay *= 2;
//   }
// }

// /**
//  * Batch‐size configurable via BULLET_BATCH_SIZE env var.
//  */
// function getBatchSize(): number {
//   const val = Deno.env.get('BULLET_BATCH_SIZE');
//   const n = val ? parseInt(val, 10) : config.DEFAULT_BATCH_SIZE;
//   return Number.isFinite(n) && n > 0 ? n : config.DEFAULT_BATCH_SIZE;
// }

// /**
//  * Split an array into chunks of size n.
//  */
// function chunkArray<T>(arr: T[], size: number): T[][] {
//   const chunks: T[][] = [];
//   for (let i = 0; i < arr.length; i += size) {
//     chunks.push(arr.slice(i, i + size));
//   }
//   return chunks;
// }


// // Robust JSON parsing for GROQ responses
// function parseGroqJsonResponse(content, originalBullets) {
//   console.log('Parsing GROQ response, content length:', content.length);
//   // Get a preview of the content for logging
//   const contentPreview = content.length > 200 ? content.substring(0, 200) + '...' : content;
//   console.log('Content preview:', contentPreview);
  
//   // Try multiple parsing strategies
//   // Strategy 1: Look for JSON array after any text prefixes and properly bound it
//   try {
//     // Find the first "[" character (start of a JSON array)
//     const jsonStartIndex = content.indexOf('[');
//     if (jsonStartIndex >= 0) {
//       // Find the matching closing bracket
//       let bracketCount = 1;
//       let jsonEndIndex = -1;
//       for (let i = jsonStartIndex + 1; i < content.length; i++) {
//         if (content[i] === '[') bracketCount++;
//         if (content[i] === ']') bracketCount--;
//         if (bracketCount === 0) {
//           jsonEndIndex = i + 1; // Include the closing bracket
//           break;
//         }
//       }
//       if (jsonEndIndex > 0) {
//         // Extract only the JSON array from start to end
//         const jsonArrayText = content.substring(jsonStartIndex, jsonEndIndex);
//         console.log('Extracted JSON array text length:', jsonArrayText.length);
//         const parsedResults = JSON.parse(jsonArrayText);
//         if (Array.isArray(parsedResults) && parsedResults.length > 0) {
//           console.log('Bounded JSON array extraction successful, count:', parsedResults.length);
//           const validatedResults = validateAndMapResults(parsedResults, originalBullets);
//           return validatedResults;
//         }
//       }
//     }
//   } catch (e) {
//     console.warn('Bounded JSON array extraction failed:', e.message);
//   }
  
//   // Strategy 2: Direct JSON parse (less likely to work if there's prefix text)
//   try {
//     const parsedResults = JSON.parse(content.trim());
//     if (Array.isArray(parsedResults) && parsedResults.length > 0) {
//       console.log('Direct JSON parse successful, count:', parsedResults.length);
//       // Ensure all bullets have the necessary properties
//       const validatedResults = validateAndMapResults(parsedResults, originalBullets);
//       return validatedResults;
//     }
//   } catch (e) {
//     console.warn('Direct JSON parse failed:', e.message);
//   }
  
//   // Strategy 3: Find and extract JSON array with regex, being careful with the boundaries
//   try {
//     // This regex tries to find a complete JSON array with proper balancing
//     // It's a simplistic approach that might not handle all nested structures perfectly
//     const arrayMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
//     if (arrayMatch) {
//       // Further validate by checking bracket balance in the matched text
//       const matchedText = arrayMatch[0];
//       let isValid = true;
//       let bracketCount = 0;
//       let curlyCount = 0;
//       for (let i = 0; i < matchedText.length; i++) {
//         if (matchedText[i] === '[') bracketCount++;
//         if (matchedText[i] === ']') bracketCount--;
//         if (matchedText[i] === '{') curlyCount++;
//         if (matchedText[i] === '}') curlyCount--;
//         // If counts go negative, it's not balanced
//         if (bracketCount < 0 || curlyCount < 0) {
//           isValid = false;
//           break;
//         }
//       }
//       // If counts aren't zero at the end, it's not balanced
//       if (bracketCount !== 0 || curlyCount !== 0) {
//         isValid = false;
//       }
//       if (isValid) {
//         const parsedResults = JSON.parse(matchedText);
//         if (Array.isArray(parsedResults) && parsedResults.length > 0) {
//           console.log('Regex JSON array extraction successful, count:', parsedResults.length);
//           const validatedResults = validateAndMapResults(parsedResults, originalBullets);
//           return validatedResults;
//         }
//       } else {
//         console.warn('Matched text is not properly balanced JSON');
//       }
//     }
//   } catch (e) {
//     console.warn('Regex JSON array extraction failed:', e.message);
//   }
  
//   // Strategy 4: Extract individual objects
//   try {
//     const objects = [];
//     const objectPattern = /\{\s*"id"\s*:\s*"([^"]*)"\s*,\s*"rewritten"\s*:\s*"([^"]*)"\s*,\s*"tips"\s*:\s*"([^"]*)"\s*\}/g;
//     let match;
//     while ((match = objectPattern.exec(content)) !== null) {
//       objects.push({
//         id: match[1],
//         rewritten: match[2],
//         tips: match[3]
//       });
//     }
//     if (objects.length > 0) {
//       console.log('Individual object extraction successful, count:', objects.length);
//       const validatedResults = validateAndMapResults(objects, originalBullets);
//       return validatedResults;
//     }
//   } catch (e) {
//     console.warn('Individual object extraction failed:', e.message);
//   }
  
//   // Strategy 5: Try to parse individual objects with more robust pattern matching
//   try {
//     // Log the entire content for debug purposes when all other strategies fail
//     console.log('Attempting last resort parsing. Content sample:', content.substring(0, Math.min(300, content.length)));
//     // Try to manually extract JSON objects one by one
//     const lines = content.split('\n');
//     let inJsonObject = false;
//     let currentObject = '';
//     const jsonObjects = [];
//     for (const line of lines) {
//       if (line.includes('{') && !inJsonObject) {
//         inJsonObject = true;
//         currentObject = line;
//       } else if (inJsonObject) {
//         currentObject += '\n' + line;
//         if (line.includes('}')) {
//           inJsonObject = false;
//           // Try to extract just the JSON object part
//           const objectMatch = currentObject.match(/\{[\s\S]*\}/);
//           if (objectMatch) {
//             try {
//               const obj = JSON.parse(objectMatch[0]);
//               jsonObjects.push(obj);
//             } catch (innerErr) {
//               console.warn('Failed to parse extracted object:', innerErr.message);
//             }
//           }
//           currentObject = '';
//         }
//       }
//     }
//     if (jsonObjects.length > 0) {
//       console.log('Line-by-line object extraction successful, count:', jsonObjects.length);
//       const validatedResults = validateAndMapResults(jsonObjects, originalBullets);
//       return validatedResults;
//     }
//   } catch (e) {
//     console.warn('Line-by-line object extraction failed:', e.message);
//   }
  
//   // Fallback: Return originals with default tips
//   console.warn('All parsing strategies failed, using original bullets');
//   return originalBullets.map((bullet) => ({
//     id: bullet.id || `fallback_${Date.now()}_${Math.floor(Math.random() * 100)}`,
//     original: bullet.original,
//     rewritten: bullet.original,
//     tips: "Try adding specific metrics and starting with a strong action verb."
//   }));
// }

// function validateAndMapResults(parsedResults, originalBullets) {
//   // Create a map of original bullets by ID for quick lookup
//   const originalBulletMap = new Map(originalBullets.map((bullet) => [
//     bullet.id,
//     bullet
//   ]));
//   // Map of processed IDs to avoid duplicates
//   const processedIds = new Set();
//   // Process and validate each result
//   const validatedResults = parsedResults.filter((result) => {
//     // Filter out entries without required properties
//     return result && result.id && (result.rewritten || result.revised || result.improved) && !processedIds.has(result.id);
//   }).map((result) => {
//     // Mark this ID as processed
//     processedIds.add(result.id);
//     // Get the original bullet
//     const originalBullet = originalBulletMap.get(result.id);
//     if (!originalBullet) {
//       console.warn(`No matching original bullet found for ID: ${result.id}`);
//       return null;
//     }
//     // Normalize field names
//     return {
//       id: result.id,
//       original: originalBullet.original,
//       rewritten: result.rewritten || result.revised || result.improved,
//       tips: result.tips || result.suggestions || result.advice || "Consider adding more quantifiable metrics and specific accomplishments."
//     };
//   }).filter((result) => result !== null);
//   // Add any missing originals
//   const resultIds = new Set(validatedResults.map((r) => r.id));
//   originalBullets.forEach((bullet) => {
//     if (!resultIds.has(bullet.id)) {
//       validatedResults.push({
//         id: bullet.id,
//         original: bullet.original,
//         rewritten: bullet.original,
//         tips: "Try adding specific metrics and starting with a strong action verb."
//       });
//     }
//   });
//   return validatedResults;
// }

// console.log("Bullet Extractor Endpoint hit")
// import { corsHeaders, callLLMWithRetry } from './utils.ts';
// import { extractSentencesFromResponse } from './sentenceDetector.ts';

// // Global batch queue for bullet processing
// if (!globalThis.bulletBatchQueue) {
//   globalThis.bulletBatchQueue = [];
//   globalThis.batchInProgress = false;
//   globalThis.pendingResults = new Map();
//   globalThis.processingInterval = null;
// }


// // Service handler for batch bullet improvement
// export function serveBulletImprover() {
//   return async (req) => {
//     try {
//       const data = await req.json();
//       if (!data.bullets || !Array.isArray(data.bullets) || data.bullets.length === 0) {
//         return new Response(JSON.stringify({
//           error: "Missing or invalid bullets array"
//         }), {
//           status: 400,
//           headers: {
//             "Content-Type": "application/json",
//             ...corsHeaders
//           }
//         });
//       }
//       // Validate each bullet has an ID and original text
//       const invalidBullet = data.bullets.find((b) => !b.id || !b.original || typeof b.original !== 'string');
//       if (invalidBullet) {
//         return new Response(JSON.stringify({
//           error: "Each bullet must have an id and original text",
//           invalidBullet
//         }), {
//           status: 400,
//           headers: {
//             "Content-Type": "application/json",
//             ...corsHeaders
//           }
//         });
//       }

//       // console.log("Beginning improvement of bullet points")
//       const improved = await improveBulletsBatch(data);
//       return new Response(JSON.stringify(improved), {
//         headers: {
//           "Content-Type": "application/json",
//           ...corsHeaders
//         }
//       });
//     } catch (error) {
//       console.error("Error in batch bullet improver service:", error);
//       return new Response(JSON.stringify({
//         error: error.message || "Failed to improve bullets in batch"
//       }), {
//         status: 500,
//         headers: {
//           "Content-Type": "application/json",
//           ...corsHeaders
//         }
//       });
//     }
//   };
// }

// /**
//  * Top‐level batch processor: splits bullets into batches, processes sequentially,
//  * and aggregates results. Honors configurable batch size and adds backoff between.
//  */
// export async function improveBulletsBatch(
//   data: { bullets: any[]; batchSize?: number }
// ): Promise<Array<{ id: string; rewritten: string; tips: string }>> {
//   const GROQ_API_KEY = Deno.env.get('GROQ');
//   if (!GROQ_API_KEY) {
//     console.warn('No GROQ key, returning originals');
//     return data.bullets.map((b) => ({ id: b.id, rewritten: b.original, tips: 'No API key configured.' }));
//   }

//   const size = data.batchSize ?? getBatchSize();
//   const chunks = chunkArray(data.bullets, size);
//   console.log(`Splitting ${data.bullets.length} bullets into ${chunks.length} batches of up to ${size}`);

//   const allResults: any[] = [];
//   for (let i = 0; i < chunks.length; i++) {
//     if (i > 0) await new Promise((r) => setTimeout(r, 2000));
//     console.log(`Processing batch ${i+1}/${chunks.length}`);
//     try {
//       const batchRes = await processBatch(chunks[i], GROQ_API_KEY);
//       allResults.push(...batchRes);
//     } catch (e) {
//       console.error('Batch failed:', e);
//       // fallback: identity map for that chunk
//       const fallback = chunks[i].map((b) => ({ id: b.id, rewritten: b.original, tips: 'Failed—please retry.' }));
//       allResults.push(...fallback);
//     }
//   }

//   return allResults;
// }


// // Single bullet improvement API - adds to queue
// export async function improveBullet(data) {
//   const { original, xyz_scores = {}, word_balance_score = 0, word_balance = {} } = data;
  
//   // Generate a unique ID for this bullet
//   const id = `single_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
//   // Create a promise that will be resolved when processing is complete
//   const resultPromise = new Promise((resolve) => {
//     // Add to the queue with its resolver
//     globalThis.pendingResults.set(id, resolve);
    
//     // Add to the batch queue
//     globalThis.bulletBatchQueue.push({
//       id,
//       original,
//       xyz_scores,
//       word_balance_score,
//       word_balance
//     });
    
//     // Start batch processing if not already running
//     ensureBatchProcessing();
//   });
  
//   // Wait for this bullet to be processed
//   const result = await resultPromise;
  
//   return {
//     rewritten: result.rewritten,
//     tips: result.tips
//   };
// }

// // Make sure batch processing is running
// function ensureBatchProcessing() {
//   // If processing is already in progress or there's no queue, do nothing
//   if (globalThis.batchInProgress || globalThis.bulletBatchQueue.length === 0) {
//     return;
//   }
  
//   // Start batch processing
//   processBatchQueue();
// }

// // Process the queued bullets in batches
// async function processBatchQueue() {
//   // Set the flag to prevent multiple concurrent processing
//   globalThis.batchInProgress = true;
  
//   try {
//     while (globalThis.bulletBatchQueue.length > 0) {
//       // Wait for a batch to accumulate or process what we have after a timeout
//       if (globalThis.bulletBatchQueue.length < 7) {
//         // Wait a bit to see if more bullets arrive to form a complete batch
//         await new Promise(resolve => setTimeout(resolve, 500));
//       }
      
//       // Process current batch (up to 5 bullets)
//       const batchSize = Math.min(7, globalThis.bulletBatchQueue.length);
//       if (batchSize === 0) break; // No bullets to process
      
//       // Get the next batch of bullets
//       const bulletBatch = globalThis.bulletBatchQueue.splice(0, batchSize);
//       console.log(`Processing batch of ${bulletBatch.length} bullets from queue`);
      
//       // Get the GROQ API key
//       const GROQ_API_KEY = Deno.env.get('GROQ');
//       if (!GROQ_API_KEY) {
//         throw new Error("GROQ API key not configured");
//       }
      
//       try {
//         // Process this batch
//         const results = await processBatch(bulletBatch, GROQ_API_KEY);
        
//         // Resolve promises for each processed bullet
//         for (const result of results) {
//           const resolve = globalThis.pendingResults.get(result.id);
//           if (resolve) {
//             resolve(result);
//             globalThis.pendingResults.delete(result.id);
//           }
//         }
//       } catch (error) {
//         console.error("Error processing bullet batch:", error);
        
//         // On error, resolve all promises in this batch with fallback results
//         for (const bullet of bulletBatch) {
//           const resolve = globalThis.pendingResults.get(bullet.id);
//           if (resolve) {
//             resolve({
//               id: bullet.id,
//               original: bullet.original,
//               rewritten: bullet.original,
//               tips: "Service error. Try adding specific metrics and starting with a strong action verb."
//             });
//             globalThis.pendingResults.delete(bullet.id);
//           }
//         }
//       }
      
//       // Respect rate limits - wait between batches
//       if (globalThis.bulletBatchQueue.length > 0) {
//         await new Promise(resolve => setTimeout(resolve, 2000));
//       }
//     }
//   } catch (error) {
//     console.error("Fatal error in batch queue processing:", error);
    
//     // Resolve all remaining pending promises with default responses
//     for (const [id, resolve] of globalThis.pendingResults.entries()) {
//       // Find the original bullet in the queue
//       const bullet = globalThis.bulletBatchQueue.find(b => b.id === id);
//       if (bullet) {
//         resolve({
//           id,
//           original: bullet.original,
//           rewritten: bullet.original,
//           tips: "Service error. Try adding specific metrics and starting with a strong action verb."
//         });
//       }
//       globalThis.pendingResults.delete(id);
//     }
    
//     // Clear the queue
//     globalThis.bulletBatchQueue = [];
//   } finally {
//     // Reset the processing flag
//     globalThis.batchInProgress = false;
    
//     // If there are still bullets in the queue, restart processing
//     if (globalThis.bulletBatchQueue.length > 0) {
//       processBatchQueue();
//     }
//   }
// }


// /**
//  * Process a single batch of bullets against GROQ API, with robust JSON parsing.
//  */
// export async function processBatch(
//   bullets: Array<{ id: string; original: string; xyz_scores?: any; word_balance_score?: number; word_balance?: any }>,
//   apiKey: string
// ): Promise<Array<{ id: string; rewritten: string; tips: string }>> {
//   const systemPrompt = `You are a professional resume bullet point improver. Your job is to:
// 1. Rewrite each given bullet point to be more impactful
// 2. Start with strong action verbs
// 3. Include quantifiable metrics where possible
// 4. Ensure clarity and conciseness (20-25 words max)
// 5. Incorporate relevant technical or leadership skills

// IMPORTANT: Return ONLY a JSON array of objects with { id, rewritten, tips }.`;

//   // build user prompt
//   let userPrompt = 'Improve the following resume bullet points:';
//   bullets.forEach((b, i) => {
//     userPrompt += `\n\n[${i + 1}] ID: ${b.id}\nOriginal: "${b.original}"`;
//   });

//   const body = JSON.stringify({
//     model: 'llama3-8b-8192',
//     messages: [
//       { role: 'system', content: systemPrompt },
//       { role: 'user', content: userPrompt },
//     ],
//     temperature: 0.3,
//     max_tokens: Math.min(2048, 512 * bullets.length),
//   });

//   const res = await fetchWithRetry(
//     'https://api.groq.com/openai/v1/chat/completions',
//     {
//       method: 'POST',
//       headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
//       body,
//     }
//   );

//   if (!res.ok) {
//     const errText = await res.text();
//     console.error('GROQ API error:', errText);
//     throw new Error(`GROQ API error: ${res.status}`);
//   }

//   const data = await res.json();
//   const content = data.choices?.[0]?.message?.content || '[]';
//   console.log('GROQ response:', content.substring(0, 200));

//   // try robust parsing strategies
//   let parsed: any[] = [];
//   try {
//     parsed = parseGroqJsonResponse(content, bullets);
//   } catch {
//     try {
//       const arr = extractSentencesFromResponse(content);
//       parsed = arr.map((s) => JSON.parse(s));
//     } catch (e) {
//       console.warn('Both parsers failed, defaulting to identity map');
//     }
//   }

//   if (!parsed.length) {
//     return bullets.map((b) => ({ id: b.id, rewritten: b.original, tips: 'Service error—please retry.' }));
//   }

//   return parsed;
// }

// /**
//  * Helper that wraps fetch and retries on 429 response with exponential backoff.
//  */
// async function fetchWithRetry(
//   url: string,
//   options: RequestInit,
//   maxRetries = 5,
//   initialDelay = 1000
// ): Promise<Response> {
//   let attempt = 0;
//   let delay = initialDelay;

//   while (true) {
//     const res = await fetch(url, options);
//     if (res.status !== 429) {
//       return res;
//     }

//     if (attempt >= maxRetries) {
//       throw new Error(`Rate limit exceeded after ${maxRetries + 1} attempts`);
//     }

//     // honor Retry-After header if present
//     const retryAfter = res.headers.get('Retry-After');
//     const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;

//     console.warn(`429 received, retrying in ${wait}ms (attempt ${attempt + 1}/${maxRetries})`);
//     await new Promise((r) => setTimeout(r, wait));

//     attempt++;
//     delay *= 2;
//   }
// }

// /**
//  * Batch‐size configurable via BULLET_BATCH_SIZE env var.
//  */
// const DEFAULT_BATCH_SIZE = 7;
// function getBatchSize(): number {
//   const val = Deno.env.get('BULLET_BATCH_SIZE');
//   const n = val ? parseInt(val, 10) : DEFAULT_BATCH_SIZE;
//   return Number.isFinite(n) && n > 0 ? n : DEFAULT_BATCH_SIZE;
// }

// /**
//  * Split an array into chunks of size n.
//  */
// function chunkArray<T>(arr: T[], size: number): T[][] {
//   const chunks: T[][] = [];
//   for (let i = 0; i < arr.length; i += size) {
//     chunks.push(arr.slice(i, i + size));
//   }
//   return chunks;
// }


// // Robust JSON parsing for GROQ responses
// function parseGroqJsonResponse(content, originalBullets) {
//   console.log('Parsing GROQ response, content length:', content.length);
//   // Get a preview of the content for logging
//   const contentPreview = content.length > 200 ? content.substring(0, 200) + '...' : content;
//   console.log('Content preview:', contentPreview);
  
//   // Try multiple parsing strategies
//   // Strategy 1: Look for JSON array after any text prefixes and properly bound it
//   try {
//     // Find the first "[" character (start of a JSON array)
//     const jsonStartIndex = content.indexOf('[');
//     if (jsonStartIndex >= 0) {
//       // Find the matching closing bracket
//       let bracketCount = 1;
//       let jsonEndIndex = -1;
//       for (let i = jsonStartIndex + 1; i < content.length; i++) {
//         if (content[i] === '[') bracketCount++;
//         if (content[i] === ']') bracketCount--;
//         if (bracketCount === 0) {
//           jsonEndIndex = i + 1; // Include the closing bracket
//           break;
//         }
//       }
//       if (jsonEndIndex > 0) {
//         // Extract only the JSON array from start to end
//         const jsonArrayText = content.substring(jsonStartIndex, jsonEndIndex);
//         console.log('Extracted JSON array text length:', jsonArrayText.length);
//         const parsedResults = JSON.parse(jsonArrayText);
//         if (Array.isArray(parsedResults) && parsedResults.length > 0) {
//           console.log('Bounded JSON array extraction successful, count:', parsedResults.length);
//           const validatedResults = validateAndMapResults(parsedResults, originalBullets);
//           return validatedResults;
//         }
//       }
//     }
//   } catch (e) {
//     console.warn('Bounded JSON array extraction failed:', e.message);
//   }
  
//   // Strategy 2: Direct JSON parse (less likely to work if there's prefix text)
//   try {
//     const parsedResults = JSON.parse(content.trim());
//     if (Array.isArray(parsedResults) && parsedResults.length > 0) {
//       console.log('Direct JSON parse successful, count:', parsedResults.length);
//       // Ensure all bullets have the necessary properties
//       const validatedResults = validateAndMapResults(parsedResults, originalBullets);
//       return validatedResults;
//     }
//   } catch (e) {
//     console.warn('Direct JSON parse failed:', e.message);
//   }
  
//   // Strategy 3: Find and extract JSON array with regex, being careful with the boundaries
//   try {
//     // This regex tries to find a complete JSON array with proper balancing
//     // It's a simplistic approach that might not handle all nested structures perfectly
//     const arrayMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
//     if (arrayMatch) {
//       // Further validate by checking bracket balance in the matched text
//       const matchedText = arrayMatch[0];
//       let isValid = true;
//       let bracketCount = 0;
//       let curlyCount = 0;
//       for (let i = 0; i < matchedText.length; i++) {
//         if (matchedText[i] === '[') bracketCount++;
//         if (matchedText[i] === ']') bracketCount--;
//         if (matchedText[i] === '{') curlyCount++;
//         if (matchedText[i] === '}') curlyCount--;
//         // If counts go negative, it's not balanced
//         if (bracketCount < 0 || curlyCount < 0) {
//           isValid = false;
//           break;
//         }
//       }
//       // If counts aren't zero at the end, it's not balanced
//       if (bracketCount !== 0 || curlyCount !== 0) {
//         isValid = false;
//       }
//       if (isValid) {
//         const parsedResults = JSON.parse(matchedText);
//         if (Array.isArray(parsedResults) && parsedResults.length > 0) {
//           console.log('Regex JSON array extraction successful, count:', parsedResults.length);
//           const validatedResults = validateAndMapResults(parsedResults, originalBullets);
//           return validatedResults;
//         }
//       } else {
//         console.warn('Matched text is not properly balanced JSON');
//       }
//     }
//   } catch (e) {
//     console.warn('Regex JSON array extraction failed:', e.message);
//   }
  
//   // Strategy 4: Extract individual objects
//   try {
//     const objects = [];
//     const objectPattern = /\{\s*"id"\s*:\s*"([^"]*)"\s*,\s*"rewritten"\s*:\s*"([^"]*)"\s*,\s*"tips"\s*:\s*"([^"]*)"\s*\}/g;
//     let match;
//     while ((match = objectPattern.exec(content)) !== null) {
//       objects.push({
//         id: match[1],
//         rewritten: match[2],
//         tips: match[3]
//       });
//     }
//     if (objects.length > 0) {
//       console.log('Individual object extraction successful, count:', objects.length);
//       const validatedResults = validateAndMapResults(objects, originalBullets);
//       return validatedResults;
//     }
//   } catch (e) {
//     console.warn('Individual object extraction failed:', e.message);
//   }
  
//   // Strategy 5: Try to parse individual objects with more robust pattern matching
//   try {
//     // Log the entire content for debug purposes when all other strategies fail
//     console.log('Attempting last resort parsing. Content sample:', content.substring(0, Math.min(300, content.length)));
//     // Try to manually extract JSON objects one by one
//     const lines = content.split('\n');
//     let inJsonObject = false;
//     let currentObject = '';
//     const jsonObjects = [];
//     for (const line of lines) {
//       if (line.includes('{') && !inJsonObject) {
//         inJsonObject = true;
//         currentObject = line;
//       } else if (inJsonObject) {
//         currentObject += '\n' + line;
//         if (line.includes('}')) {
//           inJsonObject = false;
//           // Try to extract just the JSON object part
//           const objectMatch = currentObject.match(/\{[\s\S]*\}/);
//           if (objectMatch) {
//             try {
//               const obj = JSON.parse(objectMatch[0]);
//               jsonObjects.push(obj);
//             } catch (innerErr) {
//               console.warn('Failed to parse extracted object:', innerErr.message);
//             }
//           }
//           currentObject = '';
//         }
//       }
//     }
//     if (jsonObjects.length > 0) {
//       console.log('Line-by-line object extraction successful, count:', jsonObjects.length);
//       const validatedResults = validateAndMapResults(jsonObjects, originalBullets);
//       return validatedResults;
//     }
//   } catch (e) {
//     console.warn('Line-by-line object extraction failed:', e.message);
//   }
  
//   // Fallback: Return originals with default tips
//   console.warn('All parsing strategies failed, using original bullets');
//   return originalBullets.map((bullet) => ({
//     id: bullet.id || `fallback_${Date.now()}_${Math.floor(Math.random() * 100)}`,
//     original: bullet.original,
//     rewritten: bullet.original,
//     tips: "Try adding specific metrics and starting with a strong action verb."
//   }));
// }

// function validateAndMapResults(parsedResults, originalBullets) {
//   // Create a map of original bullets by ID for quick lookup
//   const originalBulletMap = new Map(originalBullets.map((bullet) => [
//     bullet.id,
//     bullet
//   ]));
//   // Map of processed IDs to avoid duplicates
//   const processedIds = new Set();
//   // Process and validate each result
//   const validatedResults = parsedResults.filter((result) => {
//     // Filter out entries without required properties
//     return result && result.id && (result.rewritten || result.revised || result.improved) && !processedIds.has(result.id);
//   }).map((result) => {
//     // Mark this ID as processed
//     processedIds.add(result.id);
//     // Get the original bullet
//     const originalBullet = originalBulletMap.get(result.id);
//     if (!originalBullet) {
//       console.warn(`No matching original bullet found for ID: ${result.id}`);
//       return null;
//     }
//     // Normalize field names
//     return {
//       id: result.id,
//       original: originalBullet.original,
//       rewritten: result.rewritten || result.revised || result.improved,
//       tips: result.tips || result.suggestions || result.advice || "Consider adding more quantifiable metrics and specific accomplishments."
//     };
//   }).filter((result) => result !== null);
//   // Add any missing originals
//   const resultIds = new Set(validatedResults.map((r) => r.id));
//   originalBullets.forEach((bullet) => {
//     if (!resultIds.has(bullet.id)) {
//       validatedResults.push({
//         id: bullet.id,
//         original: bullet.original,
//         rewritten: bullet.original,
//         tips: "Try adding specific metrics and starting with a strong action verb."
//       });
//     }
//   });
//   return validatedResults;
// }