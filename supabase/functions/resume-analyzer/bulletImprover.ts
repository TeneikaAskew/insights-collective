console.log("Bullet Extractor Endpoint hit");
import { callLLMWithRetry } from './utils.ts';

export const config = {
  MAX_CONCURRENT_REQUESTS: 5, // Process 5 bullets simultaneously
  MAX_TOTAL_BULLETS: 15,     // Maximum total bullets to process
  MAX_RETRIES: 5,
  RATE_LIMIT_DELAY_MS: 1000, // Reduced from 2000
  RATE_LIMIT_JITTER_MS: 250  // Reduced from 500
};

// This is the primary function that needs to be exported - it's imported in bulletSuggestions.ts
export async function improveBullet(bulletData) {
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
function constructGroqPrompt(bulletData) {
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

  Format your response in clean JSON with only two fields:
  {
    "rewritten": "The improved bullet point goes here as a single string",
    "tips": "A single string with comma-separated tips for improvement"
  }
  
  Do not use arrays or nested quotes in your response. Keep it simple.

  `;
  return prompt;
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

// Process bullets in parallel with controlled concurrency
export async function processBulletsInParallel(bullets, userId) {
  try {
    console.log(`Starting parallel bullet improvement for userId: ${userId}`);
    
    // Limit total bullets to process
    const bulletsToProcess = bullets.slice(0, config.MAX_TOTAL_BULLETS);
    console.log(`Processing ${bulletsToProcess.length} out of ${bullets.length} total bullets`);
    
    // Create chunks of bullets to process in parallel
    const chunks = [];
    for (let i = 0; i < bulletsToProcess.length; i += config.MAX_CONCURRENT_REQUESTS) {
      chunks.push(bulletsToProcess.slice(i, i + config.MAX_CONCURRENT_REQUESTS));
    }
    
    const results = [];
    
    // Process each chunk in parallel
    for (const chunk of chunks) {
      console.log(`Processing chunk of ${chunk.length} bullets`);
      
      // Process all bullets in the chunk concurrently
      const chunkPromises = chunk.map(async (bullet) => {
        try {
          const result = await improveBullet(bullet);
          return {
            id: bullet.id,
            rewritten: result.rewritten,
            tips: result.tips
          };
        } catch (err) {
          console.error(`Error improving bullet ${bullet.id}:`, err);
          return {
            id: bullet.id,
            rewritten: bullet.original,
            error: true
          };
        }
      });
      
      // Wait for all bullets in chunk to complete
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
      
      // Add a small delay between chunks to prevent rate limiting
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        const jitter = Math.floor(Math.random() * config.RATE_LIMIT_JITTER_MS);
        await new Promise(resolve => setTimeout(resolve, config.RATE_LIMIT_DELAY_MS + jitter));
      }
    }
    
    // Handle any remaining bullets
    const remainingBullets = bullets.slice(config.MAX_TOTAL_BULLETS);
    if (remainingBullets.length > 0) {
      console.log(`Returning original content for ${remainingBullets.length} remaining bullets`);
      const defaultResults = remainingBullets.map(bullet => ({
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
