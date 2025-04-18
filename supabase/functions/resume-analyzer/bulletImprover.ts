import { corsHeaders } from './utils.ts';

// Batch improve bullet points with GROQ
export async function improveBulletsBatch(data: {
  bullets: Array<{
    id: string;
    original: string;
    xyz_scores?: any;
    word_balance_score?: number;
    word_balance?: any;
  }>;
  batchSize?: number;
}): Promise<Array<{
  id: string;
  original: string;
  rewritten: string;
  tips: string;
}>> {
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
      console.log(`Processing batch ${i+1}/${batches.length} with ${batch.length} bullets`);
      
      const batchResults = await processBatch(batch, GROQ_API_KEY);
      results.push(...batchResults);
    }
    
    return results;
  } catch (error) {
    console.error("Error in batch bullet improvement:", error);
    
    // Return originals with basic tips
    return data.bullets.map(bullet => ({
      id: bullet.id,
      original: bullet.original,
      rewritten: bullet.original,
      tips: "Try adding specific metrics and starting with a strong action verb."
    }));
  }
}

// Process a single batch of bullets
async function processBatch(
  bullets: Array<{
    id: string;
    original: string;
    xyz_scores?: any;
    word_balance_score?: number;
    word_balance?: any;
  }>,
  apiKey: string
): Promise<Array<{
  id: string;
  original: string;
  rewritten: string;
  tips: string;
}>> {
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
      
      userPrompt += `[${index+1}] ID: ${bullet.id}\nOriginal: "${bullet.original}"\nScores: ${scores}\n\n`;
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
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
    
    // Parse the response using robust methods from detectSentences
    const parsedResults = parseGroqJsonResponse(content, bullets);
    
    return parsedResults;
  } catch (error) {
    console.error("Error processing batch:", error);
    
    // Return originals with basic tips on error
    return bullets.map(bullet => ({
      id: bullet.id,
      original: bullet.original,
      rewritten: bullet.original,
      tips: "Service error. Try adding specific metrics and starting with a strong action verb."
    }));
  }
}

// Robust JSON parsing for GROQ responses
function parseGroqJsonResponse(
  content: string,
  originalBullets: Array<{
    id: string;
    original: string;
    xyz_scores?: any;
    word_balance_score?: number;
    word_balance?: any;
  }>
): Array<{
  id: string;
  original: string;
  rewritten: string;
  tips: string;
}> {
  console.log('Parsing GROQ response, content length:', content.length);
  
  // Get a preview of the content for logging
  const contentPreview = content.length > 200 
    ? content.substring(0, 200) + '...' 
    : content;
  console.log('Content preview:', contentPreview);
  
  // Try multiple parsing strategies
  
  // Strategy 1: Direct JSON parse
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
  
  // Strategy 2: Find and extract JSON array
  try {
    const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      const parsedResults = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsedResults) && parsedResults.length > 0) {
        console.log('JSON array extraction successful, count:', parsedResults.length);
        
        const validatedResults = validateAndMapResults(parsedResults, originalBullets);
        return validatedResults;
      }
    }
  } catch (e) {
    console.warn('JSON array extraction failed:', e.message);
  }
  
  // Strategy 3: Extract individual objects
  try {
    const objects: any[] = [];
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
  
  // Fallback: Return originals with default tips
  console.warn('All parsing strategies failed, using original bullets');
  return originalBullets.map(bullet => ({
    id: bullet.id,
    original: bullet.original,
    rewritten: bullet.original,
    tips: "Try adding specific metrics and starting with a strong action verb."
  }));
}

// Validate and map parsed results to ensure all required properties
function validateAndMapResults(
  parsedResults: any[],
  originalBullets: Array<{
    id: string;
    original: string;
    xyz_scores?: any;
    word_balance_score?: number;
    word_balance?: any;
  }>
): Array<{
  id: string;
  original: string;
  rewritten: string;
  tips: string;
}> {
  // Create a map of original bullets by ID for quick lookup
  const originalBulletMap = new Map(
    originalBullets.map(bullet => [bullet.id, bullet])
  );
  
  // Map of processed IDs to avoid duplicates
  const processedIds = new Set<string>();
  
  // Process and validate each result
  const validatedResults = parsedResults
    .filter(result => {
      // Filter out entries without required properties
      return result && result.id && 
             (result.rewritten || result.revised || result.improved) &&
             !processedIds.has(result.id);
    })
    .map(result => {
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
        tips: result.tips || result.suggestions || result.advice || 
              "Consider adding more quantifiable metrics and specific accomplishments."
      };
    })
    .filter(result => result !== null) as Array<{
      id: string;
      original: string;
      rewritten: string;
      tips: string;
    }>;
  
  // Add any missing originals
  const resultIds = new Set(validatedResults.map(r => r.id));
  
  originalBullets.forEach(bullet => {
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

// For backward compatibility with single bullet improvement
export async function improveBullet(data: {
  original: string;
  xyz_scores?: any;
  word_balance_score?: number;
  word_balance?: any;
}): Promise<{ rewritten: string; tips: string }> {
  const { original, xyz_scores = {}, word_balance_score = 0, word_balance = {} } = data;
  
  // Generate a random ID for the single bullet
  const id = `single_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // Use the batch function with a single bullet
  const results = await improveBulletsBatch({
    bullets: [{
      id,
      original,
      xyz_scores,
      word_balance_score,
      word_balance
    }],
    batchSize: 1
  });
  
  // Return the first result in the format expected by the original function
  const result = results[0] || {
    id,
    original,
    rewritten: original,
    tips: "Try adding specific metrics and starting with a strong action verb."
  };
  
  return {
    rewritten: result.rewritten,
    tips: result.tips
  };
}

// Service handler for batch bullet improvement
export function serveBulletImprover() {
  return async (req: Request) => {
    try {
      const data = await req.json();
      
      if (!data.bullets || !Array.isArray(data.bullets) || data.bullets.length === 0) {
        return new Response(
          JSON.stringify({ error: "Missing or invalid bullets array" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Validate each bullet has an ID and original text
      const invalidBullet = data.bullets.find(
        (b: any) => !b.id || !b.original || typeof b.original !== 'string'
      );
      
      if (invalidBullet) {
        return new Response(
          JSON.stringify({ 
            error: "Each bullet must have an id and original text",
            invalidBullet
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const improved = await improveBulletsBatch(data);
      
      return new Response(
        JSON.stringify(improved),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (error) {
      console.error("Error in batch bullet improver service:", error);
      return new Response(
        JSON.stringify({ 
          error: error.message || "Failed to improve bullets in batch",
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  };
}


// import { corsHeaders } from './utils.ts';

// // Improve bullet points with GROQ
// export async function improveBullet(data: {
//   original: string;
//   xyz_scores?: any;
//   word_balance_score?: number;
//   word_balance?: any;
// }): Promise<{ rewritten: string; tips: string }> {
//   try {
//     const GROQ_API_KEY = Deno.env.get('GROQ');
//     if (!GROQ_API_KEY) {
//       console.warn("GROQ API key not found, falling back to basic bullet improvements");
//       throw new Error("GROQ API key not configured");
//     }

//     const { original, xyz_scores = {}, word_balance_score = 0, word_balance = {} } = data;
    
//     // Prepare the prompt for GROQ
//     const systemPrompt = `You are a professional resume bullet point improver. Your job is to:
// 1. Rewrite the given bullet point to be more impactful
// 2. Start with strong action verbs
// 3. Include quantifiable metrics where possible
// 4. Ensure clarity and conciseness (20-25 words max)
// 5. Incorporate relevant technical or leadership skills
// 6. Provide specific tips for improvement

// Return your response as a JSON object with two properties:
// - rewritten: The improved bullet point text
// - tips: Specific tips for further improving this bullet point`;

//     const scores = JSON.stringify({
//       xyz_scores: xyz_scores,
//       word_balance_score: word_balance_score,
//       word_balance: word_balance
//     });

//     const userPrompt = `Original bullet: "${original}"\n\nScores (0-10 scale): ${scores}\n\nPlease improve this bullet point and provide tips.`;
    
//     const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${GROQ_API_KEY}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         model: 'llama3-8b-8192',
//         messages: [
//           { role: 'system', content: systemPrompt },
//           { role: 'user', content: userPrompt }
//         ],
//         temperature: 0.3,
//         max_tokens: 512
//       })
//     });

//     if (!response.ok) {
//       throw new Error(`GROQ API error: ${response.status}`);
//     }

//     const data_response = await response.json();
//     const content = data_response.choices?.[0]?.message?.content || '{}';
    
//     // Try to parse the JSON
//     let result;
//     try {
//       result = JSON.parse(content);
//     } catch (e) {
//       console.error("Error parsing GROQ response:", e);
      
//       // Try to extract JSON if the response isn't valid JSON
//       const jsonMatch = content.match(/\{[\s\S]*\}/);
//       if (jsonMatch) {
//         try {
//           result = JSON.parse(jsonMatch[0]);
//         } catch (e2) {
//           console.error("Failed to extract JSON from response:", e2);
//         }
//       }
//     }
    
//     if (!result || !result.rewritten) {
//       return {
//         rewritten: original,
//         tips: "Unable to improve this bullet point. Consider adding more specific details and metrics."
//       };
//     }
    
//     return {
//       rewritten: result.rewritten,
//       tips: result.tips || "Consider adding more quantifiable metrics and specific accomplishments."
//     };
//   } catch (error) {
//     console.error("Error in bullet improvement:", error);
//     // Return the original with basic tips
//     return {
//       rewritten: data.original,
//       tips: "Try adding specific metrics and starting with a strong action verb."
//     };
//   }
// }

// // Service handler for bullet improvement
// export function serveBulletImprover() {
//   return async (req: Request) => {
//     try {
//       const data = await req.json();
      
//       if (!data.original || typeof data.original !== 'string') {
//         return new Response(
//           JSON.stringify({ error: "Missing or invalid original bullet" }),
//           { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
//         );
//       }

//       const improved = await improveBullet(data);
      
//       return new Response(
//         JSON.stringify(improved),
//         { headers: { "Content-Type": "application/json", ...corsHeaders } }
//       );
//     } catch (error) {
//       console.error("Error in bullet improver service:", error);
//       return new Response(
//         JSON.stringify({ 
//           error: error.message || "Failed to improve bullet",
//           rewritten: data?.original || "",
//           tips: "Service error. Try using more specific language and metrics."
//         }),
//         { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
//       );
//     }
//   };
// }
