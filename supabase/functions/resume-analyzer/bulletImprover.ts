console.log("Bullet Extractor Endpoint hit");
import { callLLMWithRetry } from './utils.ts';
export const config = {
  MAX_CONCURRENT_REQUESTS: 6,
  MAX_TOTAL_BULLETS: 10,
  MAX_RETRIES: 3,
  RATE_LIMIT_DELAY_MS: 2000,
  RATE_LIMIT_JITTER_MS: 500,
  CHUNK_TIMEOUT_MS: 30000,
  BACKOFF_MULTIPLIER: 1.5,
  BATCH_SIZE: 6
};
// Utility function for exponential backoff
async function backoffDelay(attempt) {
  const delay = Math.min(config.RATE_LIMIT_DELAY_MS * Math.pow(config.BACKOFF_MULTIPLIER, attempt), 10000 // Max 10 second delay
  );
  const jitter = Math.random() * config.RATE_LIMIT_JITTER_MS;
  await new Promise((resolve)=>setTimeout(resolve, delay + jitter));
}
// This is the primary function that needs to be exported - it's imported in bulletSuggestions.ts
export async function improveBullet(bulletData) {
  let attempts = 0;
  while(attempts < config.MAX_RETRIES){
    try {
      console.log(`Improving bullet (attempt ${attempts + 1}): ${bulletData.original.substring(0, 30)}...`);
      // Add backoff delay between attempts
      if (attempts > 0) {
        await backoffDelay(attempts);
      }
      const { system, prompt } = constructGroqPrompt(bulletData);
      const result = await callLLMWithRetry(system, prompt);
      // Validate result before processing
      if (!result || typeof result !== 'string') {
        throw new Error('Empty or invalid response from LLM');
      }
      const processedResult = processGroqResponse(result, bulletData);
      return processedResult;
    } catch (error) {
      console.error(`Error improving bullet (attempt ${attempts + 1}):`, error);
      attempts++;
      // On last attempt, return fallback
      if (attempts === config.MAX_RETRIES) {
        return {
          rewritten: bulletData.original,
          tips: "Unable to improve bullet point after multiple attempts. Consider adding metrics and using stronger action verbs."
        };
      }
    }
  }
}
// Helper function to construct the prompt for GROQ
function constructGroqPrompt(bulletData) {
  // Construct a prompt based on the bullet data;
  const system = `You are a professional resume writer specializing in optimizing bullet points. 
Your task is to rewrite resume bullets to be more impactful, achievement-focused, 
and industry-appropriate. Focus on using strong action verbs, incorporating metrics, 
and making each bullet point concise yet comprehensive.`;
  // Prompt template for each bullet point
  const prompt = `Rewrite this resume bullet point to make it stronger:

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

Format your response in clean JSON with only two fields:
{
  "rewritten": "The improved bullet point goes here as a single string",
  "tips": "A single string with comma-separated tips for improvement"
}

Do not use arrays or nested quotes in your response. Keep it simple.`;
  // return prompt;
  return {
    system,
    prompt: prompt
  };
}
// Helper function to process the GROQ response
function processGroqResponse(response, originalBullet) {
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
// Process bullets in parallel with controlled concurrency and timeouts
export async function processBulletsInParallel(bullets: any[], userId: string) {
  try {
    console.log(`Starting bullet improvement for userId: ${userId}`);
    
    // Limit total bullets to process
    const bulletsToProcess = bullets.slice(0, config.MAX_TOTAL_BULLETS);
    console.log(`Processing ${bulletsToProcess.length} out of ${bullets.length} total bullets`);
    
    const results: Array<{
      id: string;
      rewritten: string;
      error?: boolean;
      errorMessage?: string;
      unprocessed?: boolean;
    }> = [];
    
    // Process bullets in batches of 6
    for (let i = 0; i < bulletsToProcess.length; i += config.BATCH_SIZE) {
      const batchStartTime = Date.now();
      console.log(`Processing batch starting at index ${i}`);
      
      // Get current batch (up to 6 bullets)
      const batch = bulletsToProcess.slice(i, i + config.BATCH_SIZE);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (bullet) => {
        try {
          // Add timeout protection
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Bullet processing timeout')), config.CHUNK_TIMEOUT_MS);
          });
          
          const bulletPromise = improveBullet(bullet);
          
          // Race between timeout and processing
          const result = await Promise.race([bulletPromise, timeoutPromise])
            .catch((error) => {
              console.error(`Error processing bullet: ${error.message}`);
              return {
                id: bullet.id,
                rewritten: bullet.original,
                error: true,
                errorMessage: error.message
              };
            });
            
          return {
            id: bullet.id,
            ...result || { rewritten: bullet.original, error: true }
          };
        } catch (err) {
          console.error(`Error improving bullet ${bullet.id}:`, err);
          return {
            id: bullet.id,
            rewritten: bullet.original,
            error: true,
            errorMessage: err.message
          };
        }
      });
      
      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Calculate time taken for this batch
      const batchEndTime = Date.now();
      const batchDuration = batchEndTime - batchStartTime;
      
      // If we have more bullets to process, ensure we wait until a minute has passed since batch start
      if (i + config.BATCH_SIZE < bulletsToProcess.length) {
        const timeToWait = Math.max(0, 60000 - batchDuration); // Wait until a minute has passed
        if (timeToWait > 0) {
          console.log(`Batch completed in ${batchDuration}ms. Waiting ${timeToWait}ms before next batch to respect rate limit...`);
          await new Promise(resolve => setTimeout(resolve, timeToWait));
        } else {
          console.log(`Batch took ${batchDuration}ms. Proceeding with next batch immediately.`);
        }
      }
    }
    
    // Handle any remaining bullets
    const remainingBullets = bullets.slice(config.MAX_TOTAL_BULLETS);
    if (remainingBullets.length > 0) {
      console.log(`Returning original content for ${remainingBullets.length} remaining bullets`);
      const defaultResults = remainingBullets.map((bullet) => ({
        id: bullet.id,
        rewritten: bullet.original,
        unprocessed: true
      }));
      results.push(...defaultResults);
    }
    
    return results;
  } catch (error) {
    console.error('Error in processBulletsInParallel:', error);
    throw error;
  }
}
// Export the new parallel processing function as the main interface
export { processBulletsInParallel as processBatchQueue };
