import { corsHeaders } from './utils.ts';
import { extractSentencesFromResponse } from './sentenceDetector.ts';

// Service handler for batch bullet improvement
export function serveBulletImprover() {
  return async (req)=>{
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
      const invalidBullet = data.bullets.find((b)=>!b.id || !b.original || typeof b.original !== 'string');
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

// // Batch improve bullet points with GROQ
// export async function improveBulletsBatch(data) {
//   try {
//     const GROQ_API_KEY = Deno.env.get('GROQ');
//     if (!GROQ_API_KEY) {
//       console.warn("GROQ API key not found, falling back to basic bullet improvements");
//       throw new Error("GROQ API key not configured");
//     }
//     const { bullets, batchSize = 5 } = data;
//     // Process in batches to avoid token limits
//     const results = [];
//     const batches = [];
//     // Split into batches
//     for(let i = 0; i < bullets.length; i += batchSize){
//       batches.push(bullets.slice(i, i + batchSize));
//     }
//     console.log(`Processing ${bullets.length} bullets in ${batches.length} batches`);
//     // Process each batch
//     for(let i = 0; i < batches.length; i++){
//       const batch = batches[i];
//       console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} bullets`);
//       const batchResults = await processBatch(batch, GROQ_API_KEY);
//       results.push(...batchResults);
//     }
//     return results;
//   } catch (error) {
//     console.error("Error in batch bullet improvement:", error);
//     // Return originals with basic tips
//     return data.bullets.map((bullet)=>({
//         id: bullet.id,
//         original: bullet.original,
//         rewritten: bullet.original,
//         tips: "Try adding specific metrics and starting with a strong action verb."
//       }));
//   }
// }
// / Improved implementation for bullet point processing
export async function improveBullet(data) {
  const { original, xyz_scores = {}, word_balance_score = 0, word_balance = {} } = data;
  
  // Store the single bullet request in a queue for batching
  // This is a simple in-memory approach - could be enhanced with a proper queue system
  if (!globalThis.bulletQueue) {
    globalThis.bulletQueue = [];
  }
  
  // Generate a random ID for the single bullet
  const id = `single_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // Add this bullet to the queue
  globalThis.bulletQueue.push({
    id,
    original,
    xyz_scores,
    word_balance_score,
    word_balance
  });
  
  // Process in batch if we have enough bullets or after a delay
  let result;
  if (globalThis.bulletQueue.length >= 5) {
    // We have enough bullets to process as a batch
    const bullets = [...globalThis.bulletQueue]; // Create a copy
    globalThis.bulletQueue = []; // Reset the queue
    
    // Now process these bullets as a batch
    const results = await improveBulletsBatch({
      bullets,
      batchSize: bullets.length
    });
    
    // Find our result from the batch results
    result = results.find(r => r.id === id) || {
      id,
      original,
      rewritten: original,
      tips: "Try adding specific metrics and starting with a strong action verb."
    };
  } else {
    // We don't have enough bullets yet, so process this one normally
    // but keep track of it in our queue for future batching
    const results = await improveBulletsBatch({
      bullets: [
        {
          id,
          original,
          xyz_scores,
          word_balance_score,
          word_balance
        }
      ],
      batchSize: 1
    });
    
    result = results[0] || {
      id,
      original,
      rewritten: original,
      tips: "Try adding specific metrics and starting with a strong action verb."
    };
  }
  
  // Return the result in the format expected by the original function
  return {
    rewritten: result.rewritten,
    tips: result.tips
  };
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
    bullets.forEach((bullet, index)=>{
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
    console.log("GROQ Improved Bullets: ", content)
  //   // Parse the response using robust methods from detectSentences
  //   const parsedResults = parseGroqJsonResponse(content, bullets);
  //   return parsedResults;
  // } catch (error) {
  //   console.error("Error processing batch:", error);
  //   // Return originals with basic tips on error
  //   return bullets.map((bullet)=>({
  //       id: bullet.id,
  //       original: bullet.original,
  //       rewritten: bullet.original,
  //       tips: "Service error. Try adding specific metrics and starting with a strong action verb."
  //     }));
  // }
          // 1) First try your robust sentence extractor
      let parsedResults = [];
      try {
        parsedResults = parseGroqJsonResponse(content, bullets);
      } catch (ex) {
        console.warn('extractSentencesFromResponse failed, falling back to JSON‑array parse');
      }
    
      
      // 2) If that didn’t yield anything, fall back to your existing parser
      if (parsedResults.length === 0) {
        try {
          const jsonOnly = extractSentencesFromResponse(content);
          parsedResults = jsonOnly.map(str => JSON.parse(str));
        }
        catch (ex) {
          console.warn('parseGroqJsonResponse also failed, falling back to identity map');
        }
      }
      
      // 3) Last resort: return the originals mapped back
      if (parsedResults.length === 0) {
        parsedResults = bullets.map(bullet => ({
          id: bullet.id,
          original: bullet.original,
          rewritten: bullet.original,
          tips: "Service error. Try adding specific metrics and starting with a strong action verb."
        }));
      }
      
      return parsedResults;

     } catch (error) {
    console.error("Error processing batch:", error);
    // In an absolute failure, at least don’t crash—return your identity map again
    return bullets.map(b => ({
      id: b.id,
      original: b.original,
      rewritten: b.original,
      tips: "Service error. Try adding specific metrics and starting with a strong action verb."
    }));
  }
}

  
// // Robust JSON parsing for GROQ responses
// function parseGroqJsonResponse(content, originalBullets) {
//   console.log('Parsing GROQ response, content length:', content.length);
//   // Get a preview of the content for logging
//   const contentPreview = content.length > 200 ? content.substring(0, 200) + '...' : content;
//   console.log('Content preview:', contentPreview);
//   // Try multiple parsing strategies
//   // Strategy 1: Direct JSON parse
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
//   // Strategy 2: Find and extract JSON array
//   try {
//     const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
//     if (arrayMatch) {
//       const parsedResults = JSON.parse(arrayMatch[0]);
//       if (Array.isArray(parsedResults) && parsedResults.length > 0) {
//         console.log('JSON array extraction successful, count:', parsedResults.length);
//         const validatedResults = validateAndMapResults(parsedResults, originalBullets);
//         return validatedResults;
//       }
//     }
//   } catch (e) {
//     console.warn('JSON array extraction failed:', e.message);
//   }
//   // Strategy 3: Extract individual objects
//   try {
//     const objects = [];
//     const objectPattern = /\{\s*"id"\s*:\s*"([^"]*)"\s*,\s*"rewritten"\s*:\s*"([^"]*)"\s*,\s*"tips"\s*:\s*"([^"]*)"\s*\}/g;
//     let match;
//     while((match = objectPattern.exec(content)) !== null){
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
//   // Fallback: Return originals with default tips
//   console.warn('All parsing strategies failed, using original bullets');
//   return originalBullets.map((bullet)=>({
//       id: bullet.id,
//       original: bullet.original,
//       rewritten: bullet.original,
//       tips: "Try adding specific metrics and starting with a strong action verb."
//     }));
// }
// // Validate and map parsed results to ensure all required properties


// Robust JSON parsing for GROQ responses
// function parseGroqJsonResponse(content, originalBullets) {
//   console.log('Parsing GROQ response, content length:', content.length);
//   // Get a preview of the content for logging
//   const contentPreview = content.length > 200 ? content.substring(0, 200) + '...' : content;
//   console.log('Content preview:', contentPreview);
  
//   // Try multiple parsing strategies
//   // Strategy 1: Look for JSON array after any text prefixes
//   try {
//     // Find the first "[" character (start of a JSON array)
//     const jsonStartIndex = content.indexOf('[');
//     if (jsonStartIndex >= 0) {
//       // Extract from this point to the end of the content
//       const possibleJson = content.substring(jsonStartIndex);
//       const parsedResults = JSON.parse(possibleJson.trim());
//       if (Array.isArray(parsedResults) && parsedResults.length > 0) {
//         console.log('JSON array extraction successful, count:', parsedResults.length);
//         const validatedResults = validateAndMapResults(parsedResults, originalBullets);
//         return validatedResults;
//       }
//     }
//   } catch (e) {
//     console.warn('JSON array extraction failed:', e.message);
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
  
//   // Strategy 3: Find and extract JSON array with regex
//   try {
//     const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
//     if (arrayMatch) {
//       const parsedResults = JSON.parse(arrayMatch[0]);
//       if (Array.isArray(parsedResults) && parsedResults.length > 0) {
//         console.log('Regex JSON array extraction successful, count:', parsedResults.length);
//         const validatedResults = validateAndMapResults(parsedResults, originalBullets);
//         return validatedResults;
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
//     while((match = objectPattern.exec(content)) !== null){
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
  
//   // Fallback: Return originals with default tips
//   console.warn('All parsing strategies failed, using original bullets');
//   return originalBullets.map((bullet) => ({
//     id: bullet.id || `fallback_${Date.now()}_${Math.floor(Math.random() * 100)}`,
//     original: bullet.original,
//     rewritten: bullet.original,
//     tips: "Try adding specific metrics and starting with a strong action verb."
//   }));
// }

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
    while((match = objectPattern.exec(content)) !== null){
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
  const originalBulletMap = new Map(originalBullets.map((bullet)=>[
      bullet.id,
      bullet
    ]));
  // Map of processed IDs to avoid duplicates
  const processedIds = new Set();
  // Process and validate each result
  const validatedResults = parsedResults.filter((result)=>{
    // Filter out entries without required properties
    return result && result.id && (result.rewritten || result.revised || result.improved) && !processedIds.has(result.id);
  }).map((result)=>{
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
  }).filter((result)=>result !== null);
  // Add any missing originals
  const resultIds = new Set(validatedResults.map((r)=>r.id));
  originalBullets.forEach((bullet)=>{
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

// Alternative implementation with a timeout-based batch processor
// This could be more sophisticated with a proper queue and worker system
export async function improveBulletsBatch(data) {
  const { original, xyz_scores = {}, word_balance_score = 0, word_balance = {} } = data;
  
  // Initialize the queue and processing state if not exists
  if (!globalThis.bulletQueue) {
    globalThis.bulletQueue = [];
    globalThis.processingBatch = false;
    globalThis.pendingResults = new Map();
  }
  
  // Generate a random ID for the single bullet
  const id = `single_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // Create a promise that will be resolved when the result is ready
  const resultPromise = new Promise((resolve) => {
    globalThis.pendingResults.set(id, resolve);
  });
  
  // Add this bullet to the queue
  globalThis.bulletQueue.push({
    id,
    original,
    xyz_scores,
    word_balance_score,
    word_balance,
  });
  
  // Start the batch processor if it's not already running
  if (!globalThis.processingBatch) {
    processBatchQueue();
  }
  
  // Wait for the result to be ready
  const resolvedResult = await resultPromise;
  return {
    rewritten: resolvedResult.rewritten,
    tips: resolvedResult.tips
  };
}

// Process the batch queue
async function processBatchQueue() {
  globalThis.processingBatch = true;
  
  try {
    // Process bullets in batches of 5 (or whatever the queue size is if < 5)
    while (globalThis.bulletQueue.length > 0) {
      const batchSize = Math.min(5, globalThis.bulletQueue.length);
      const bullets = globalThis.bulletQueue.splice(0, batchSize);
      
      console.log(`Processing batch of ${bullets.length} bullets`);
      
      // Process this batch
      const results = await improveBulletsBatch({
        bullets,
        batchSize
      });
      
      // Resolve promises for each bullet in the batch
      for (const result of results) {
        const resolve = globalThis.pendingResults.get(result.id);
        if (resolve) {
          resolve(result);
          globalThis.pendingResults.delete(result.id);
        }
      }
      
      // Wait for a short time to avoid hitting rate limits
      if (globalThis.bulletQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error("Error processing batch queue:", error);
    
    // Resolve all pending promises with a default result
    for (const [id, resolve] of globalThis.pendingResults.entries()) {
      const bullet = globalThis.bulletQueue.find(b => b.id === id);
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
    globalThis.bulletQueue = [];
  } finally {
    globalThis.processingBatch = false;
  }
}

// // For backward compatibility with single bullet improvement
// export async function improveBullet(data) {
//   const { original, xyz_scores = {}, word_balance_score = 0, word_balance = {} } = data;
//   // Generate a random ID for the single bullet
//   const id = `single_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
//   // Use the batch function with a single bullet
//   const results = await improveBulletsBatch({
//     bullets: [
//       {
//         id,
//         original,
//         xyz_scores,
//         word_balance_score,
//         word_balance
//       }
//     ],
//     batchSize: 1
//   });
//   // Return the first result in the format expected by the original function
//   const result = results[0] || {
//     id,
//     original,
//     rewritten: original,
//     tips: "Try adding specific metrics and starting with a strong action verb."
//   };
//   return {
//     rewritten: result.rewritten,
//     tips: result.tips
//   };
// }