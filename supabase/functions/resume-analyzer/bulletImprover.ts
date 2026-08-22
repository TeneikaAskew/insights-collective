import { callLLMWithRetry} from './utils.ts';
import { analyzeWordBalance, xyzCheck } from './bulletAnalysis.ts';
export const config = {
  MAX_CONCURRENT_REQUESTS: 6,
  MAX_TOTAL_BULLETS: 2,
  MAX_RETRIES: 3,
  RATE_LIMIT_DELAY_MS: 2000,
  RATE_LIMIT_JITTER_MS: 500,
  CHUNK_TIMEOUT_MS: 30000,
  BACKOFF_MULTIPLIER: 1.5,
  BATCH_SIZE: 6,
  BULLET_PROCESS_SEQUENTIAL: true
};
interface BulletData {
  id?: string;
  original: string;
  xyz_scores?: any;
  word_balance_score?: number;
  word_balance?: any;
}
// Utility function for exponential backoff
async function backoffDelay(attempt: number) {
  const delay = Math.min(config.RATE_LIMIT_DELAY_MS * Math.pow(config.BACKOFF_MULTIPLIER, attempt), 10000 // Max 10 second delay
  );
  const jitter = Math.random() * config.RATE_LIMIT_JITTER_MS;
  await new Promise((resolve)=>setTimeout(resolve, delay + jitter));
}
// Helper to capitalize the first word of a string
function capitalizeFirstWord(text: string) {
  if (!text || typeof text !== 'string') return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
// This is the primary function that needs to be exported - it's imported in bulletSuggestions.ts
export async function improveBullet(bulletData: BulletData) {
  let attempts = 0;
  while(attempts < config.MAX_RETRIES){
    try {
      console.log(`Improving bullet (attempt ${attempts + 1}): ${bulletData.original.substring(0, 70)}...`);
      // Add backoff delay between attempts
      if (attempts > 0) {
        await backoffDelay(attempts);
      }
      console.log(`[PBIP]Constructing prompt for bullet ${bulletData.id}: ${bulletData.original}`);
      const { system, prompt } = constructGroqPrompt(bulletData);
      console.log(`[IB]Calling LLM for bullet ${bulletData.id}: ${bulletData.original}`);
      const result = await callLLMWithRetry(system, prompt, 1, 3, "BULLET_IMPROVER");
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
function constructGroqPrompt(bulletData: BulletData) {
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
function processGroqResponse(response: any, bulletData: BulletData) {
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
  const bulletsToProcess = bullets.slice(0, limit);
  // for (let i = 0; i < bullets.length; i++) {
  //   if (i < limit) {
      // try {
        // const bullet = bullets[i];
        // const bulletPromises = bullets.slice(0, limit).map((bullet, i) => {
          
        // If bullet doesn't have an id, assign a short numeric one
        // if (!bullet.id) {
        //   bullet.id = (i + 1).toString();
          // console.warn(`[PBIP]Bullet at index ${i} is missing an 'id' property. Assigned id: ${bullet.id}`, bullet);
        // }
        // console.log(`[PBIP]Processing bullet ${bullet.id}: ${bullet.original}`);
        // return improveBullet(bullet)
        //     .then(improvedBullet => ({ bullet, improvedBullet }))
        //     .catch(error => ({ bullet, error }));
        // });

        // const improvedBullet = await improveBullet(bullet);
        // console.log(`[PBIP]Processing bullet ${bullets[i].id}: ${bullets[i].original}`);
        // const improvedBullet = await improveBullet(bullets[i]);
        // // improvedBullets.push(improvedBullet);
        // Await all improvements in parallel
        // Check if sequential processing is requested via an option or environment variable
        // process.env.BULLET_PROCESS_SEQUENTIAL
        console.log(`[PBIP]Sequential processing: ${config.BULLET_PROCESS_SEQUENTIAL}`);
        const sequential = config.BULLET_PROCESS_SEQUENTIAL;
        // sequentially its running 15 seconds for 2 bullets, about 7.5 secs each
        // parallel is running 24 seconds for 2 bullets, about 12 secs each

        if (sequential) {
          // Process bullets one by one (sequentially)
          for (const [i, bullet] of bullets.slice(0, limit).entries()) {
            if (!bullet.id) bullet.id = (i + 1).toString();
            console.log(`[PBIP]Processing bullet ${bullet.id}: ${bullet.original}`);
            try {
              const improvedBullet = await improveBullet(bullet);
              if (improvedBullet && improvedBullet.rewritten) {
                console.log(`[PBIP]XYZ/WB Scoring for bullet ${bullet.id}: ${improvedBullet.rewritten}`);
                const wb = analyzeWordBalance(improvedBullet.rewritten);
                const xyz = xyzCheck(improvedBullet.rewritten);
                const hasMinimumContent = improvedBullet.rewritten.length > 20 && improvedBullet.rewritten.split(/\s+/).length > 4;
                const contentPenalty = hasMinimumContent ? 0 : 25;
                const bullet_total = Math.max(0, xyz.xyz_total - contentPenalty);
                console.log(`[PBIP]XYZ/WB Score for bullet ${bullet.id}:\n${bullet_total}\n${xyz.xyz_total}\n${wb.word_balance_score}`);
                // Capitalize the first word of tips if present
                if (improvedBullet.tips && typeof improvedBullet.tips === 'string') {
                  improvedBullet.tips = capitalizeFirstWord(improvedBullet.tips);
                }
                improvedBullets.push({
                  id: bullet.id,
                  ...improvedBullet,
                  xyz_scores: xyz,
                  bullet_total: bullet_total,
                  word_balance: wb
                });
          } else {
            improvedBullets.push(improvedBullet);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          console.error(`Error processing bullet: ${message}, ${stack}`);
          improvedBullets.push({
          id: bullet.id,
          original: bullet.original,
          rewritten: bullet.original,
          tips: "An error occurred while improving this bullet."
          });
        }
      }
    } else {
      const bulletPromises = bulletsToProcess.map((bullet, i) => {
        if (!bullet.id) bullet.id = (i + 1).toString();
        console.log(`[PBIP]Processing bullet ${bullet.id}: ${bullet.original}`);
        return improveBullet(bullet)
          .then(improvedBullet => ({ bullet, improvedBullet }))
          .catch(error => ({ bullet, error }));
      });
      // Await all improvements in parallel
      const results = await Promise.all(bulletPromises);

      for (const result of results) {
        if ('error' in result && result.error) {
          console.error(`Error processing bullet: ${result.error.message}`);
          improvedBullets.push({
      id: result.bullet.id,
      original: result.bullet.original,
      rewritten: result.bullet.original,
      tips: "An error occurred while improving this bullet."
          });
          continue;
        }
        if ('improvedBullet' in result && result.improvedBullet && result.improvedBullet.rewritten) {
          const wb = analyzeWordBalance(result.improvedBullet.rewritten);
          const xyz = xyzCheck(result.improvedBullet.rewritten);
          const hasMinimumContent = result.improvedBullet.rewritten.length > 20 && result.improvedBullet.rewritten.split(/\s+/).length > 4;
          const contentPenalty = hasMinimumContent ? 0 : 25;
          const bullet_total = Math.max(0, xyz.xyz_total - contentPenalty);
          // Capitalize the first word of tips if present
          if (result.improvedBullet.tips && typeof result.improvedBullet.tips === 'string') {
            result.improvedBullet.tips = capitalizeFirstWord(result.improvedBullet.tips);
          }
          improvedBullets.push({
            id: result.bullet.id,
            ...result.improvedBullet,
            xyz_scores: xyz,
            bullet_total: bullet_total,
            word_balance: wb
          });
        } else if ('improvedBullet' in result && result.improvedBullet) {
          improvedBullets.push(result.improvedBullet);
        }
      }
    }

        // Fill in the rest with limit message if needed
        for (let i = limit; i < bullets.length; i++) {
          improvedBullets.push({
            id: bullets[i].id,
            original: bullets[i].original,
            rewritten: bullets[i].original,
            tips: "You've reached your daily processing limit."
          });
        }
        // improvedBullets.push(improvedBullet);
  //     } catch (error) {
  //       console.error(`Error processing bullet: ${error.message}`);
  //       improvedBullets.push({
  //         id: bullets[i].id,
  //         original: bullets[i].original,
  //         rewritten: bullets[i].original,
  //         tips: "An error occurred while improving this bullet."
  //       });
  //     }
  //   } else {
  //     improvedBullets.push({
  //       id: bullets[i].id,
  //       original: bullets[i].original,
  //       rewritten: bullets[i].original,
  //       tips: "You've reached your daily processing limit."
  //     });
  //   }
  // }
  return improvedBullets;
}
export { processBulletsInParallel };