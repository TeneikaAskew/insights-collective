
import { supabase } from '../_shared/utils.ts';

// Setting up the config for the bullet improver
export const config = {
  batchSize: 3, // Process bullets in batches of 3
  maxRetries: 2, // Number of retries for failed API calls
  useGroq: true, // Whether to use Groq API
  useTogether: true, // Whether to use Together AI API
  addUuidToItems: true, // Whether to add UUIDs to items for tracking
};

// Main function to process bullets in batches
export async function processBatchQueue(bullets, userId) {
  console.log(`Processing ${bullets.length} bullets in batches of ${config.batchSize}`);
  
  // Add UUIDs to bullets if needed
  const preparedBullets = config.addUuidToItems
    ? bullets.map(bullet => ({ ...bullet, id: crypto.randomUUID() }))
    : bullets;
  
  // Split bullets into batches
  const batches = [];
  for (let i = 0; i < preparedBullets.length; i += config.batchSize) {
    batches.push(preparedBullets.slice(i, i + config.batchSize));
  }
  
  console.log(`Created ${batches.length} batches`);
  
  // Process each batch
  const results = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1} of ${batches.length} with ${batch.length} bullets`);
    
    try {
      const batchResults = await processBulletBatch(batch, userId);
      results.push(...batchResults);
    } catch (error) {
      console.error(`Error processing batch ${i + 1}:`, error);
      // Add the originals back with error status
      results.push(...batch.map(bullet => ({
        ...bullet,
        rewritten: bullet.original,
        tips: "Failed to process this bullet."
      })));
    }
  }
  
  return results;
}

// Process a batch of bullets
async function processBulletBatch(bullets, userId) {
  // Use whichever API is enabled
  if (config.useGroq) {
    return processWithGroq(bullets, userId);
  } else if (config.useTogether) {
    return processWithTogether(bullets, userId);
  } else {
    throw new Error('No LLM API enabled');
  }
}

// Process bullets with Groq API
async function processWithGroq(bullets, userId) {
  const GROQ = Deno.env.get('GROQ');
  if (!GROQ) throw new Error('GROQ API key not found');
  
  const prompt = `
  Improve the following resume bullet points to be more impactful and effective.
  For each bullet point:
  1. Rewrite it to emphasize quantifiable achievements using XYZ format (Action → Context → Result)
  2. Add useful tips for further improvement
  
  Format your response as a valid JSON array with objects containing:
  - id: The original bullet's ID
  - original: The original text
  - rewritten: Your improved version
  - tips: 1-2 specific tips for further improvement
  
  Original bullets:
  ${JSON.stringify(bullets.map(b => ({id: b.id, text: b.original})))}
  
  IMPORTANT: Return ONLY the JSON array without any explanations, markdown formatting, or additional text.
  `;

  let attempt = 0;
  while (attempt < config.maxRetries) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: "system", content: "You are an expert resume writer that improves bullet points." },
            { role: "user", content: prompt }
          ],
          temperature: 0.5,
          max_tokens: 1500
        })
      });
      
      if (!resp.ok) throw new Error(`Groq API error: ${resp.status}`);
      
      const result = await resp.json();
      const content = result.choices[0].message.content;
      
      // Extract JSON array from response (it might be wrapped in markdown or other text)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Could not extract JSON from response');
      
      const jsonStr = jsonMatch[0];
      const improved = JSON.parse(jsonStr);
      
      return bullets.map(bullet => {
        const improved_bullet = improved.find(b => b.id === bullet.id);
        return {
          ...bullet,
          rewritten: improved_bullet?.rewritten || bullet.original,
          tips: improved_bullet?.tips || "No specific tips provided."
        };
      });
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      attempt++;
      if (attempt >= config.maxRetries) throw error;
      await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
    }
  }
}

// Process bullets with Together AI
async function processWithTogether(bullets, userId) {
  const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
  if (!TOGETHER_API_KEY) throw new Error('Together API key not found');
  
  const prompt = `
  Improve the following resume bullet points to be more impactful and effective.
  For each bullet point:
  1. Rewrite it to emphasize quantifiable achievements using XYZ format (Action → Context → Result)
  2. Add useful tips for further improvement
  
  Format your response as a valid JSON array with objects containing:
  - id: The original bullet's ID
  - original: The original text
  - rewritten: Your improved version
  - tips: 1-2 specific tips for further improvement
  
  Original bullets:
  ${JSON.stringify(bullets.map(b => ({id: b.id, text: b.original})))}
  
  IMPORTANT: Return ONLY the JSON array without any explanations, markdown formatting, or additional text.
  `;

  let attempt = 0;
  while (attempt < config.maxRetries) {
    try {
      const resp = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.1-8B-Instruct',
          messages: [
            { role: "system", content: "You are an expert resume writer that improves bullet points." },
            { role: "user", content: prompt }
          ],
          temperature: 0.5,
          max_tokens: 1500
        })
      });
      
      if (!resp.ok) throw new Error(`Together API error: ${resp.status}`);
      
      const result = await resp.json();
      const content = result.choices[0].message.content;
      
      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Could not extract JSON from response');
      
      const jsonStr = jsonMatch[0];
      const improved = JSON.parse(jsonStr);
      
      return bullets.map(bullet => {
        const improved_bullet = improved.find(b => b.id === bullet.id);
        return {
          ...bullet,
          rewritten: improved_bullet?.rewritten || bullet.original,
          tips: improved_bullet?.tips || "No specific tips provided."
        };
      });
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      attempt++;
      if (attempt >= config.maxRetries) throw error;
      await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
    }
  }
}
