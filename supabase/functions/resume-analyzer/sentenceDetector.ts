// import { supabase } from '@/integrations/supabase/client';
// import { supabase } from '../../../integrations/supabase/client.ts';
import { supabase, callLLMWithRetry } from './utils.ts';
const bulletCache = new Map(); // Cache for storing bullet points by user ID

export function getSentencesFromCache(userId?: string) {
  if (!userId) return null;
  
  console.log(`getSentencesFromCache: Checking cache for userId=${userId}`);
  const cachedSentences = bulletCache.get(`user:${userId}:bullets`);
  console.log(`getSentencesFromCache: Cache ${cachedSentences ? 'hit' : 'miss'} for userId=${userId}`);
  
  return cachedSentences || null;
}

// Modified detectSentences function to use the retry logic
export async function detectSentences(text: string, userId?: string) {
  console.log('Sentence Detection function hit');
  // First check if we have cached sentences for this user
  // if (userId) {
  //   const cachedSentences = getSentencesFromCache(userId);
  //   if (cachedSentences && cachedSentences.length > 0) {
  //     console.log(`detectSentences: Using ${cachedSentences.length} cached sentences for userId=${userId}`);
  //     console.log(`Current cache size: ${bulletCache.size} entries`);
  //     return cachedSentences;
  //   }
  // }
  const startTime = Date.now();
  console.log(`detectSentences: Starting extraction [${new Date().toISOString()}]`);
  console.log('detectSentences: input text: ', text);
  console.log('detectSentences: input text length=', text.length);
  console.log('detectSentences: userId provided=', userId ? 'Yes' : 'No');
  
  try {
    // Truncate to avoid token limits
    const maxChars = 12000;
    const processedText = text.length > maxChars ? text.substring(0, maxChars) : text;
    console.log(`detectSentences: processedText length=${processedText.length} (${text.length > maxChars ? 'truncated' : 'unchanged'})`);
    
    // Further truncate or split text if it's still very large
    // This helps avoid hitting token limits
    const chunks = [];
    if (processedText.length > 9000) {
      // Split into multiple chunks with some overlap
      const chunkSize = 6000;
      const overlap = 500;
      for (let i = 0; i < processedText.length; i += chunkSize - overlap) {
        const end = Math.min(i + chunkSize, processedText.length);
        chunks.push(processedText.substring(i, end));
      }
      // console.log(`detectSentences: Split text into ${chunks.length} chunks`);
    } else {
      chunks.push(processedText);
    }
    
    // Process each chunk with rate limit handling
    const allSentences = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`detectSentences: Processing chunk ${i+1}/${chunks.length} (${chunks[i].length} chars)`);
      
      // Call AI API with retry logic
      // console.log(`detectSentences: Calling GROQ API with retry for chunk ${i+1} [${new Date().toISOString()}]`);
      const apiStartTime = Date.now();
      
      ///PROMPTS
      const system = `You are a sentence extraction expert. Extract resume bullet points and return ONLY a JSON array of strings. 
      Do not include any explanatory text before or after the JSON array.`
      
      const user = `Extract resume bullet points from the following text:\n\n${chunks[i]}`
      
      // Use our retry function
      // const data = await callLLMWithRetry(system, user);
      const content = await callLLMWithRetry(system, user);
      
      const apiEndTime = Date.now();
      // console.log(`detectSentences: GROQ API call for chunk ${i+1} completed in ${apiEndTime - apiStartTime}ms`);
      
      // const content = data.choices?.[0]?.message?.content || '';
      console.log(`detectSentences: raw content from API chunk ${i+1} (${content.length} chars) preview=`, 
                  content.length > 100 ? content.slice(0, 100) + '...' : content);
      
      // Process this chunk
      console.log(`detectSentences: Starting sentence extraction from chunk ${i+1}`);
      const parseStartTime = Date.now();
      const chunkSentences = extractSentencesFromResponse(content);
      const parseEndTime = Date.now();
      console.log(`detectSentences: Found ${chunkSentences.length} sentences in chunk ${i+1}`);
      
      // Add to overall results
      allSentences.push(...chunkSentences);
      
      // Add delay between chunks to avoid rate limits
      if (i < chunks.length - 1) {
        const delayMs = 2000; // 2 second delay between chunks
        console.log(`detectSentences: Waiting ${delayMs}ms before processing next chunk`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // Deduplicate sentences from all chunks
    // console.log(`detectSentences: Total raw sentences from all chunks: ${allSentences.length}`);
    const sentences = cleanAndDeduplicate(allSentences);
    // console.log(`detectSentences: Final deduplicated sentences: ${sentences.length}`);
    
    // Save to database if userId is provided
    if (userId) {
      console.log(`detectSentences: Saving ${sentences.length} sentences to database for userId=${userId}`);
      const dbStartTime = Date.now();
      try {
        // Save to cache if userId is provided
        try {
            if (userId && sentences.length > 0) {
              console.log(`detectSentences: Saving sentences to cache for userId=${userId}`);
              bulletCache.set(`user:${userId}:bullets`, sentences);
              console.log(`detectSentences: Successfully saved ${sentences.length} sentences to cache for userId=${userId}`);
              // console.log(`New cache size: ${bulletCache.size} entries`);
          }
        } catch (cacheError) {
          console.error('detectSentences: Cache save failed:', cacheError);
          console.log('detectSentences: Continuing to database save despite cache error');
        }
        
        await saveSentencesToDatabase(userId, sentences);
        const dbEndTime = Date.now();
        console.log(`detectSentences: Database save completed in ${dbEndTime - dbStartTime}ms`);
      } catch (dbError) {
        console.error('detectSentences: Database save failed:', dbError);
        console.log('detectSentences: Continuing to return sentences despite database error');
      }
    }
    
    const endTime = Date.now();
    console.log(`[detectSentences]: Function completed in ${(endTime - startTime)/1000}s`);
    return sentences;
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const errorTime = Date.now() - startTime;
    console.error(`detectSentences: Error after ${errorTime}ms:`, message);
    if (stack) {
      console.error('detectSentences: Error stack:', stack);
    }
    throw error;
  }
}


// Helper function to extract sentences from the response with multiple fallback strategies
export function extractSentencesFromResponse(content: string) {
  console.log('extractSentencesFromResponse: Starting extraction');
  let sentences = [];
  // Try multiple extraction methods, from most structured to least
  // Method 4: Extract quoted strings individually
    if (sentences.length === 0) {
    // console.log('extractSentencesFromResponse: Trying Method 1 - Individual string extraction');
    const items = [];
    const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    let match;
    let matchCount = 0;
    while((match = pattern.exec(content)) !== null){
      matchCount++;
      if (match[1] && match[1].trim().length > 15) {
        items.push(match[1].trim());
      }
    }
    console.log(`extractSentencesFromResponse: Method 1 - found ${matchCount} regex matches, ${items.length} valid items`);
    if (items.length > 0) {
      console.log('extractSentencesFromResponse: Method 1 successful');
      sentences = items;
    } else {
      console.log('extractSentencesFromResponse: Method 1 failed - no valid items found');
    }
  }

  // Method 2: Extract JSON array if embedded in text
  if (sentences.length === 0) {
    // console.log('extractSentencesFromResponse: Trying Method 2 - JSON array extraction');
    // console.log(`extractSentencesFromResponse: Content includes '[': ${content.includes('[')}, includes ']': ${content.includes(']')}`);
    if (content.includes('[') && content.includes(']')) {
      try {
        const jsonMatch = content.match(/\[\s*[\s\S]*\]/);
        if (jsonMatch) {
          // console.log(`extractSentencesFromResponse: Method 2 - found potential JSON: ${jsonMatch[0].substring(0, 50)}...`);
          const parsedArray = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsedArray) && parsedArray.length > 0) {
            console.log(`extractSentencesFromResponse: Method 2 successful - parsed ${parsedArray.length} items`);
            sentences = parsedArray;
          } else {
            console.log('extractSentencesFromResponse: Method 2 parsed successfully but result is not a valid array or is empty');
          }
        } else {
          console.log('extractSentencesFromResponse: Method 2 - no JSON array pattern found');
        }
      } catch (e) {
        console.log(`extractSentencesFromResponse: Method 2 failed - ${e instanceof Error ? e.message : String(e)}`);
      // Continue to next method
      }
    } else {
      console.log('extractSentencesFromResponse: Method 2 skipped - content does not include brackets');
    }
  }
  // Method 3: Fix malformed JSON with double quotes issue
  if (sentences.length === 0) {
    // console.log('extractSentencesFromResponse: Trying Method 3 - Fixing double quotes issue');
    console.log(`extractSentencesFromResponse: Content includes '""': ${content.includes('""')}`);
    if (content.includes('""')) {
      try {
        // Replace double quotes with single quotes and try to parse
        // console.log('extractSentencesFromResponse: Method 3 - applying quote fixes to content');
        const fixedContent = content.replace(/\[\s*\n?/g, '[').replace(/\s*\n?\]/g, ']').replace(/""/g, '"').replace(/",\s*(?=\])/g, '"');
        // console.log(`extractSentencesFromResponse: Method 3 - fixed content preview: ${fixedContent.substring(0, 50)}...`);
        // Try to extract array with fixed quotes
        const jsonMatch = fixedContent.match(/\[\s*[\s\S]*\]/);
        if (jsonMatch) {
          console.log(`extractSentencesFromResponse: Method 3 - found potential JSON after fixing: ${jsonMatch[0].substring(0, 50)}...`);
          const parsedArray = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsedArray) && parsedArray.length > 0) {
            console.log(`extractSentencesFromResponse: Method 3 successful - parsed ${parsedArray.length} items`);
            sentences = parsedArray;
          } else {
            console.log('extractSentencesFromResponse: Method 3 parsed successfully but result is not a valid array or is empty');
          }
        } else {
          console.log('extractSentencesFromResponse: Method 3 - no JSON array pattern found after fixing');
        }
      } catch (e) {
        console.log(`extractSentencesFromResponse: Method 3 failed - ${e instanceof Error ? e.message : String(e)}`);
      // Continue to next method
      }
    } else {
      console.log('extractSentencesFromResponse: Method 3 skipped - content does not include double quotes');
    }
  }
  // Method 4: Extract quoted strings individually
  if (sentences.length === 0) {
  //   console.log('extractSentencesFromResponse: Trying Method 4 - Individual string extraction');
  //   const items = [];
  //   const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  //   let match;
  //   let matchCount = 0;
  //   while((match = pattern.exec(content)) !== null){
  //     matchCount++;
  //     if (match[1] && match[1].trim().length > 15) {
  //       items.push(match[1].trim());
  //     }
  //   }
  //   console.log(`extractSentencesFromResponse: Method 4 - found ${matchCount} regex matches, ${items.length} valid items`);
  //   if (items.length > 0) {
  //     console.log('extractSentencesFromResponse: Method 4 successful');
  //     sentences = items;
  //   } else {
  //     console.log('extractSentencesFromResponse: Method 4 failed - no valid items found');
  //   }
  // }
  
  // Method 4: Try direct JSON parsing if it looks like a JSON array
  // console.log('extractSentencesFromResponse: Trying Method 4 - Direct JSON parsing');
  // console.log(`extractSentencesFromResponse: Content starts with '[': ${content.trim().startsWith('[')}, ends with ']': ${content.trim().endsWith(']')}`);
  if (content.trim().startsWith('[') && content.trim().endsWith(']')) {
    try {
      const parsedArray = JSON.parse(content.trim());
      if (Array.isArray(parsedArray) && parsedArray.length > 0) {
        console.log(`extractSentencesFromResponse: Method 4 successful - parsed ${parsedArray.length} items`);
        sentences = parsedArray;
      } else {
        console.log('extractSentencesFromResponse: Method 4 parsed successfully but result is not a valid array or is empty');
      }
    } catch (e) {
      console.log(`extractSentencesFromResponse: Method 4 failed - ${e instanceof Error ? e.message : String(e)}`);
    // Continue to next method if this fails
    }
  } else {
    console.log('extractSentencesFromResponse: Method 4 skipped - content does not start/end with brackets');
  }
  }
  // Method 5: Handle doubly quoted strings (""text"") which appeared in the logs
  if (sentences.length === 0) {
    // console.log('extractSentencesFromResponse: Trying Method 5 - Double-quote pattern extraction');
    const items = [];
    // This regex looks for patterns like ""text""
    const doubleQuotePattern = /""([^"]*)""(?:,|$)/g;
    let match;
    let matchCount = 0;
    while((match = doubleQuotePattern.exec(content)) !== null){
      matchCount++;
      if (match[1] && match[1].trim().length > 15) {
        items.push(match[1].trim());
      }
    }
    console.log(`extractSentencesFromResponse: Method 5 - found ${matchCount} double-quote matches, ${items.length} valid items`);
    if (items.length > 0) {
      console.log('extractSentencesFromResponse: Method 5 successful');
      sentences = items;
    } else {
      console.log('extractSentencesFromResponse: Method 5 failed - no valid items found');
    }
  }
  // Method 6: Last resort - extract by lines
  if (sentences.length === 0) {
    // console.log('extractSentencesFromResponse: Trying Method 6 - Line-by-line extraction (last resort)');
    const lines = content.split(/\r?\n/);
    // console.log(`extractSentencesFromResponse: Method 6 - content split into ${lines.length} lines`);
    sentences = lines.map((line)=>line.trim()).filter((line)=>{
      // Filter criteria for likely bullet points
      const isValid = line.length > 15 && !line.startsWith('[') && !line.startsWith(']') && !line.includes('```');
      return isValid;
    });
    console.log(`extractSentencesFromResponse: Method 6 - found ${sentences.length} valid lines`);
  }
  // Final cleanup and deduplication
  console.log(`extractSentencesFromResponse: Pre-cleanup sentence count: ${sentences.length}`);
  const result = cleanAndDeduplicate(sentences);
  console.log(`extractSentencesFromResponse: Post-cleanup sentence count: ${result.length}`);
  return result;
}


// Helper function to clean and deduplicate the extracted sentences
function cleanAndDeduplicate(sentences: unknown[]) {
  console.log(`cleanAndDeduplicate: Starting cleanup of ${sentences.length} sentences`);
  const uniqueMap = new Map();
  let cleanedCount = 0;
  let droppedCount = 0;
  let duplicateCount = 0;
  sentences.forEach((sentence, index)=>{
    if (typeof sentence === 'string') {
      // Clean the sentence
      let cleaned = sentence.trim().replace(/^["']+|["']+$/g, '') // Remove surrounding quotes
      .replace(/\\"/g, '"') // Unescape quotes
      .replace(/\s+/g, ' '); // Normalize whitespace
      cleanedCount++;
      // Store in map if it meets length criteria
      if (cleaned.length > 15) {
        // Use lowercase for deduplication key, but preserve original case
        const key = cleaned.toLowerCase();
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, cleaned);
        } else {
          duplicateCount++;
          if (index < 5) {
            console.log(`cleanAndDeduplicate: Duplicate found (sample): "${cleaned.substring(0, 50)}..."`);
          }
        }
      } else {
        droppedCount++;
        if (index < 5) {
          console.log(`cleanAndDeduplicate: Sentence too short (sample): "${cleaned}"`);
        }
      }
    }
  });
  const result = Array.from(uniqueMap.values());
  // console.log(`cleanAndDeduplicate: Cleaned ${cleanedCount}, dropped ${droppedCount} (too short), found ${duplicateCount} duplicates`);
  console.log(`cleanAndDeduplicate: Final unique sentence count: ${result.length}`);
  return result;
}


// Helper function to save sentences to database
export async function saveSentencesToDatabase(userId: string, sentences: unknown[]) {
  if (userId) {
    try {
      await supabase.from('resumes').update({
        sentences: sentences,
        sentences_updated_at: new Date().toISOString()
      }).eq('user_id', userId);
      console.log('Sentences stored in database for user:', userId);
    } catch (error) {
      console.error('Error saving sentences to database:', error);
    }
  }
}
