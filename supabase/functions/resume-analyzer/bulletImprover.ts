import { corsHeaders, callLLMWithRetry, callTracking } from './utils.ts';
export const config = {
  MAX_CONCURRENT_REQUESTS: 6,
  MAX_TOTAL_BULLETS: 2,
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
          original: bulletData.original,
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
function processGroqResponse(response, bulletData) {
  try {
    // If the response is already in the expected format, return it
    if (response.rewritten && response.tips) {
      return {
        original: bulletData.original,
        rewritten: response.rewritten,
        tips: response.tips
      };
    }
    // Try to parse the response if it's a JSON string
    if (typeof response === 'string') {
      try {
        const parsedResponse = JSON.parse(response);
        if (parsedResponse.rewritten && parsedResponse.tips) {
          return {
            original: bulletData.original,
            rewritten: parsedResponse.rewritten,
            tips: parsedResponse.tips
          };
        }
      } catch (e) {
        // Not valid JSON, continue with other parsing methods
      }
      // Try to extract from the string
      const rewrittenMatch = response.match(/["']rewritten["']\s*:\s*["']([^"']+)["']/);
      const tipsMatch = response.match(/["']tips["']\s*:\s*["']([^"']+)["']/);
      if (rewrittenMatch && tipsMatch) {
        return {
          original: bulletData.original,
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
          original: bulletData.original,
          rewritten: contentBetweenBrackets[1].trim(),
          tips: "Extracted from API response."
        };
      }
    }
    // Last resort fallback
    console.warn("Could not parse GROQ response, returning original bullet");
    return {
      original: bulletData.original,
      rewritten: bulletData.original,
      tips: "Could not generate specific tips. Consider adding metrics and using stronger action verbs."
    };
  } catch (error) {
    console.error("Error processing GROQ response:", error);
    return {
      original: bulletData.original,
      rewritten: bulletData.original,
      tips: "Error processing the API response. Consider adding metrics and using stronger action verbs."
    };
  }
}
// Process bullets in parallel with controlled concurrency and timeouts
async function processBulletsInParallel(bullets: any[], userId: string) {
  const limit = config.MAX_TOTAL_BULLETS || 10;
  console.log(`Processing up to ${limit} of ${bullets.length} total bullets`);
  const improvedBullets: any[] = [];
  for (let i = 0; i < bullets.length; i++) {
    if (i < limit) {
      try {
        const improvedBullet = await improveBullet(bullets[i]);
        improvedBullets.push(improvedBullet);
      } catch (error) {
        console.error(`Error processing bullet: ${error.message}`);
        improvedBullets.push({
          original: bullets[i].original,
          rewritten: bullets[i].original,
          tips: "An error occurred while improving this bullet."
        });
      }
    } else {
      improvedBullets.push({
        original: bullets[i].original,
        rewritten: bullets[i].original,
        tips: "You've reached your daily processing limit."
      });
    }
  }
  return improvedBullets;
}
// Export the new parallel processing function as the main interface
export { processBulletsInParallel };

export async function bulletImprover(userId, enhanced = null) {
  try {
    callTracking.addCall(); // Add API call tracking
    // ... existing code ...
  } catch (error) {
    console.error("Error in bulletImprover:", error);
    return {
      error: "An error occurred while processing the request. Please try again later."
    };
  }
}