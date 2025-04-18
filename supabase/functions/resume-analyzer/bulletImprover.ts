import { corsHeaders } from './utils.ts';
import { extractSentencesFromResponse } from './sentenceDetector.ts';

// Service handler for batch bullet improvement
export function serveBulletImprover() {
  return async (req) => {
    try {
      const data = await req.json();
      if (!data.bullets || !Array.isArray(data.bullets) || data.bullets.length === 0) {
        return new Response(JSON.stringify({
          error: "Missing or invalid bullets array"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      // Validate each bullet has an ID and original text
      const invalidBullet = data.bullets.find((b) => !b.id || !b.original || typeof b.original !== 'string');
      if (invalidBullet) {
        return new Response(JSON.stringify({
          error: "Each bullet must have an id and original text",
          invalidBullet
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      const improved = await improveBulletsBatch(data);
      return new Response(JSON.stringify(improved), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error("Error in batch bullet improver service:", error);
      return new Response(JSON.stringify({
        error: error.message || "Failed to improve bullets in batch"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
  };
}

// Global batch queue for bullet processing
if (!globalThis.bulletBatchQueue) {
  globalThis.bulletBatchQueue = [];
  globalThis.batchInProgress = false;
  globalThis.pendingResults = new Map();
  globalThis.processingInterval = null;
}

// For main batch processing requests (multiple bullets)
export async function improveBulletsBatch(data) {
  try {
    const GROQ_API_KEY = Deno.env.get('GROQ');
    if (!GROQ_API_KEY) {
      console.warn("GROQ API key not found, falling back to basic bullet improvements");
      throw new Error("GROQ API key not configured");
    }
    const { bullets, batchSize = 5 } = data;
    // Process in batches to avoid token limits
    const results = [];
    const batches = [];
    // Split into batches
    for (let i = 0; i < bullets.length; i += batchSize) {
      batches.push(bullets.slice(i, i + batchSize));
    }
    console.log(`Processing ${bullets.length} bullets in ${batches.length} batches`);
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} bullets`);
      // Wait between batches to avoid rate limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      const batchResults = await processBatch(batch, GROQ_API_KEY);
      results.push(...batchResults);
    }
    return results;
  } catch (error) {
    console.error("Error in batch bullet improvement:", error);
    // Return originals with basic tips
    return data.bullets.map((bullet) => ({
      id: bullet.id,
      original: bullet.original,
      rewritten: bullet.original,
      tips: "Try adding specific metrics and starting with a strong action verb."
    }));
  }
}

// Single bullet improvement API - adds to queue
export async function improveBullet(data) {
  const { original, xyz_scores = {}, word_balance_score = 0, word_balance = {} } = data;
  
  // Generate a unique ID for this bullet
  const id = `single_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // Create a promise that will be resolved when processing is complete
  const resultPromise = new Promise((resolve) => {
    // Add to the queue with its resolver
    globalThis.pendingResults.set(id, resolve);
    
    // Add to the batch queue
    globalThis.bulletBatchQueue.push({
      id,
      original,
      xyz_scores,
      word_balance_score,
      word_balance
    });
    
    // Start batch processing if not already running
    ensureBatchProcessing();
  });
  
  // Wait for this bullet to be processed
  const result = await resultPromise;
  
  return {
    rewritten: result.rewritten,
    tips: result.tips
  };
}

// Make sure batch processing is running
function ensureBatchProcessing() {
  // If processing is already in progress or there's no queue, do nothing
  if (globalThis.batchInProgress || globalThis.bulletBatchQueue.length === 0) {
    return;
  }
  
  // Start batch processing
  processBatchQueue();
}

// Process the queued bullets in batches
async function processBatchQueue() {
  // Set the flag to prevent multiple concurrent processing
  globalThis.batchInProgress = true;
  
  try {
    while (globalThis.bulletBatchQueue.length > 0) {
      // Wait for a batch to accumulate or process what we have after a timeout
      if (globalThis.bulletBatchQueue.length < 5) {
        // Wait a bit to see if more bullets arrive to form a complete batch
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Process current batch (up to 5 bullets)
      const batchSize = Math.min(5, globalThis.bulletBatchQueue.length);
      if (batchSize === 0) break; // No bullets to process
      
      // Get the next batch of bullets
      const bulletBatch = globalThis.bulletBatchQueue.splice(0, batchSize);
      console.log(`Processing batch of ${bulletBatch.length} bullets from queue`);
      
      // Get the GROQ API key
      const GROQ_API_KEY = Deno.env.get('GROQ');
      if (!GROQ_API_KEY) {
        throw new Error("GROQ API key not configured");
      }
      
      try {
        // Process this batch
        const results = await processBatch(bulletBatch, GROQ_API_KEY);
        
        // Resolve promises for each processed bullet
        for (const result of results) {
          const resolve = globalThis.pendingResults.get(result.id);
          if (resolve) {
            resolve(result);
            globalThis.pendingResults.delete(result.id);
          }
        }
      } catch (error) {
        console.error("Error processing bullet batch:", error);
        
        // On error, resolve all promises in this batch with fallback results
        for (const bullet of bulletBatch) {
          const resolve = globalThis.pendingResults.get(bullet.id);
          if (resolve) {
            resolve({
              id: bullet.id,
              original: bullet.original,
              rewritten: bullet.original,
              tips: "Service error. Try adding specific metrics and starting with a strong action verb."
            });
            globalThis.pendingResults.delete(bullet.id);
          }
        }
      }
      
      // Respect rate limits - wait between batches
      if (globalThis.bulletBatchQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    console.error("Fatal error in batch queue processing:", error);
    
    // Resolve all remaining pending promises with default responses
    for (const [id, resolve] of globalThis.pendingResults.entries()) {
      // Find the original bullet in the queue
      const bullet = globalThis.bulletBatchQueue.find(b => b.id === id);
      if (bullet) {
        resolve({
          id,
          original: bullet.original,
          rewritten: bullet.original,
          tips: "Service error. Try adding specific metrics and starting with a strong action verb."
        });
      }
      globalThis.pendingResults.delete(id);
    }
    
    // Clear the queue
    globalThis.bulletBatchQueue = [];
  } finally {
    // Reset the processing flag
    globalThis.batchInProgress = false;
    
    // If there are still bullets in the queue, restart processing
    if (globalThis.bulletBatchQueue.length > 0) {
      processBatchQueue();
    }
  }
}

// Process a single batch of bullets
async function processBatch(bullets, apiKey) {
  try {
    // Prepare the prompt for GROQ
    const systemPrompt = `You are a professional resume bullet point improver. Your job is to:
        1. Rewrite each given bullet point to be more impactful
        2. Start with strong action verbs
        3. Include quantifiable metrics where possible
        4. Ensure clarity and conciseness (20-25 words max)
        5. Incorporate relevant technical or leadership skills
        
        IMPORTANT: Return your response as a JSON array of objects. Each object must have these properties:
        - id: The ID of the original bullet (preserve this exactly)
        - rewritten: The improved bullet point text
        - tips: Specific tips for further improving this bullet point (2-3 sentences max)`;
    // Build user prompt with all bullets in the batch
    let userPrompt = "Improve the following resume bullet points:\n\n";
    bullets.forEach((bullet, index) => {
      const scores = JSON.stringify({
        xyz_scores: bullet.xyz_scores || {},
        word_balance_score: bullet.word_balance_score || 0,
        word_balance: bullet.word_balance || {}
      });
      userPrompt += `[${index + 1}] ID: ${bullet.id}\nOriginal: "${bullet.original}"\nScores: ${scores}\n\n`;
    });
    userPrompt += "Return a JSON array of objects with id, rewritten, and tips properties.";
    
    // Call GROQ API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: Math.min(2048, 512 * bullets.length) // Scale with batch size
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('GROQ API error:', errorText);
      throw new Error(`GROQ API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    console.log("GROQ Improved Bullets: ", content);
    
    // 1) First try robust sentence extractor
    let parsedResults = [];
    try {
      parsedResults = parseGroqJsonResponse(content, bullets);
    } catch (ex) {
      console.warn('extractSentencesFromResponse failed, falling back to JSON‑array parse');
    }
    
    // 2) If that didn't yield anything, fall back to existing parser
    if (parsedResults.length === 0) {
      try {
        const jsonOnly = extractSentencesFromResponse(content);
        parsedResults = jsonOnly.map((str) => JSON.parse(str));
      } catch (ex) {
        console.warn('parseGroqJsonResponse also failed, falling back to identity map');
      }
    }
    
    // 3) Last resort: return the originals mapped back
    if (parsedResults.length === 0) {
      parsedResults = bullets.map((bullet) => ({
        id: bullet.id,
        original: bullet.original,
        rewritten: bullet.original,
        tips: "Service error. Try adding specific metrics and starting with a strong action verb."
      }));
    }
    
    return parsedResults;
  } catch (error) {
    console.error("Error processing batch:", error);
    // In an absolute failure, at least don't crash—return identity map again
    return bullets.map((b) => ({
      id: b.id,
      original: b.original,
      rewritten: b.original,
      tips: "Service error. Try adding specific metrics and starting with a strong action verb."
    }));
  }
}

// Robust JSON parsing for GROQ responses
function parseGroqJsonResponse(content, originalBullets) {
  console.log('Parsing GROQ response, content length:', content.length);
  // Get a preview of the content for logging
  const contentPreview = content.length > 200 ? content.substring(0, 200) + '...' : content;
  console.log('Content preview:', contentPreview);
  
  // Try multiple parsing strategies
  // Strategy 1: Look for JSON array after any text prefixes and properly bound it
  try {
    // Find the first "[" character (start of a JSON array)
    const jsonStartIndex = content.indexOf('[');
    if (jsonStartIndex >= 0) {
      // Find the matching closing bracket
      let bracketCount = 1;
      let jsonEndIndex = -1;
      for (let i = jsonStartIndex + 1; i < content.length; i++) {
        if (content[i] === '[') bracketCount++;
        if (content[i] === ']') bracketCount--;
        if (bracketCount === 0) {
          jsonEndIndex = i + 1; // Include the closing bracket
          break;
        }
      }
      if (jsonEndIndex > 0) {
        // Extract only the JSON array from start to end
        const jsonArrayText = content.substring(jsonStartIndex, jsonEndIndex);
        console.log('Extracted JSON array text length:', jsonArrayText.length);
        const parsedResults = JSON.parse(jsonArrayText);
        if (Array.isArray(parsedResults) && parsedResults.length > 0) {
          console.log('Bounded JSON array extraction successful, count:', parsedResults.length);
          const validatedResults = validateAndMapResults(parsedResults, originalBullets);
          return validatedResults;
        }
      }
    }
  } catch (e) {
    console.warn('Bounded JSON array extraction failed:', e.message);
  }
  
  // Strategy 2: Direct JSON parse (less likely to work if there's prefix text)
  try {
    const parsedResults = JSON.parse(content.trim());
    if (Array.isArray(parsedResults) && parsedResults.length > 0) {
      console.log('Direct JSON parse successful, count:', parsedResults.length);
      // Ensure all bullets have the necessary properties
      const validatedResults = validateAndMapResults(parsedResults, originalBullets);
      return validatedResults;
    }
  } catch (e) {
    console.warn('Direct JSON parse failed:', e.message);
  }
  
  // Strategy 3: Find and extract JSON array with regex, being careful with the boundaries
  try {
    // This regex tries to find a complete JSON array with proper balancing
    // It's a simplistic approach that might not handle all nested structures perfectly
    const arrayMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (arrayMatch) {
      // Further validate by checking bracket balance in the matched text
      const matchedText = arrayMatch[0];
      let isValid = true;
      let bracketCount = 0;
      let curlyCount = 0;
      for (let i = 0; i < matchedText.length; i++) {
        if (matchedText[i] === '[') bracketCount++;
        if (matchedText[i] === ']') bracketCount--;
        if (matchedText[i] === '{') curlyCount++;
        if (matchedText[i] === '}') curlyCount--;
        // If counts go negative, it's not balanced
        if (bracketCount < 0 || curlyCount < 0) {
          isValid = false;
          break;
        }
      }
      // If counts aren't zero at the end, it's not balanced
      if (bracketCount !== 0 || curlyCount !== 0) {
        isValid = false;
      }
      if (isValid) {
        const parsedResults = JSON.parse(matchedText);
        if (Array.isArray(parsedResults) && parsedResults.length > 0) {
          console.log('Regex JSON array extraction successful, count:', parsedResults.length);
          const validatedResults = validateAndMapResults(parsedResults, originalBullets);
          return validatedResults;
        }
      } else {
        console.warn('Matched text is not properly balanced JSON');
      }
    }
  } catch (e) {
    console.warn('Regex JSON array extraction failed:', e.message);
  }
  
  // Strategy 4: Extract individual objects
  try {
    const objects = [];
    const objectPattern = /\{\s*"id"\s*:\s*"([^"]*)"\s*,\s*"rewritten"\s*:\s*"([^"]*)"\s*,\s*"tips"\s*:\s*"([^"]*)"\s*\}/g;
    let match;
    while ((match = objectPattern.exec(content)) !== null) {
      objects.push({
        id: match[1],
        rewritten: match[2],
        tips: match[3]
      });
    }
    if (objects.length > 0) {
      console.log('Individual object extraction successful, count:', objects.length);
      const validatedResults = validateAndMapResults(objects, originalBullets);
      return validatedResults;
    }
  } catch (e) {
    console.warn('Individual object extraction failed:', e.message);
  }
  
  // Strategy 5: Try to parse individual objects with more robust pattern matching
  try {
    // Log the entire content for debug purposes when all other strategies fail
    console.log('Attempting last resort parsing. Content sample:', content.substring(0, Math.min(300, content.length)));
    // Try to manually extract JSON objects one by one
    const lines = content.split('\n');
    let inJsonObject = false;
    let currentObject = '';
    const jsonObjects = [];
    for (const line of lines) {
      if (line.includes('{') && !inJsonObject) {
        inJsonObject = true;
        currentObject = line;
      } else if (inJsonObject) {
        currentObject += '\n' + line;
        if (line.includes('}')) {
          inJsonObject = false;
          // Try to extract just the JSON object part
          const objectMatch = currentObject.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            try {
              const obj = JSON.parse(objectMatch[0]);
              jsonObjects.push(obj);
            } catch (innerErr) {
              console.warn('Failed to parse extracted object:', innerErr.message);
            }
          }
          currentObject = '';
        }
      }
    }
    if (jsonObjects.length > 0) {
      console.log('Line-by-line object extraction successful, count:', jsonObjects.length);
      const validatedResults = validateAndMapResults(jsonObjects, originalBullets);
      return validatedResults;
    }
  } catch (e) {
    console.warn('Line-by-line object extraction failed:', e.message);
  }
  
  // Fallback: Return originals with default tips
  console.warn('All parsing strategies failed, using original bullets');
  return originalBullets.map((bullet) => ({
    id: bullet.id || `fallback_${Date.now()}_${Math.floor(Math.random() * 100)}`,
    original: bullet.original,
    rewritten: bullet.original,
    tips: "Try adding specific metrics and starting with a strong action verb."
  }));
}

function validateAndMapResults(parsedResults, originalBullets) {
  // Create a map of original bullets by ID for quick lookup
  const originalBulletMap = new Map(originalBullets.map((bullet) => [
    bullet.id,
    bullet
  ]));
  // Map of processed IDs to avoid duplicates
  const processedIds = new Set();
  // Process and validate each result
  const validatedResults = parsedResults.filter((result) => {
    // Filter out entries without required properties
    return result && result.id && (result.rewritten || result.revised || result.improved) && !processedIds.has(result.id);
  }).map((result) => {
    // Mark this ID as processed
    processedIds.add(result.id);
    // Get the original bullet
    const originalBullet = originalBulletMap.get(result.id);
    if (!originalBullet) {
      console.warn(`No matching original bullet found for ID: ${result.id}`);
      return null;
    }
    // Normalize field names
    return {
      id: result.id,
      original: originalBullet.original,
      rewritten: result.rewritten || result.revised || result.improved,
      tips: result.tips || result.suggestions || result.advice || "Consider adding more quantifiable metrics and specific accomplishments."
    };
  }).filter((result) => result !== null);
  // Add any missing originals
  const resultIds = new Set(validatedResults.map((r) => r.id));
  originalBullets.forEach((bullet) => {
    if (!resultIds.has(bullet.id)) {
      validatedResults.push({
        id: bullet.id,
        original: bullet.original,
        rewritten: bullet.original,
        tips: "Try adding specific metrics and starting with a strong action verb."
      });
    }
  });
  return validatedResults;
}