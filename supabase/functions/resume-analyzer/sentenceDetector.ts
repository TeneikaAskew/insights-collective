console.log('Sentence Detection function hit');
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
// This function sets up Supabase client with service role key credentials from env
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !supabaseKey) {
    console.error('getSupabaseClient: Missing Supabase credentials in environment variables!');
    throw new Error('Missing Supabase credentials');
  }
  return createClient(supabaseUrl, supabaseKey);
}
// Function to detect sentences from resume text and save to database
export async function detectSentences(text, userId) {
  const startTime = Date.now();
  console.log(`detectSentences: Starting extraction [${new Date().toISOString()}]`);
  console.log('detectSentences: input text length=', text.length);
  console.log('detectSentences: userId provided=', userId ? 'Yes' : 'No');
  try {
    const GROQ_API_KEY = Deno.env.get('GROQ');
    if (!GROQ_API_KEY) {
      console.warn("detectSentences: GROQ API key not found, falling back to regex extraction");
      throw new Error("GROQ API key not configured");
    }
    console.log('detectSentences: GROQ API key found, proceeding with API call');
    // Truncate to avoid token limits
    const maxChars = 12000;
    const processedText = text.length > maxChars ? text.substring(0, maxChars) : text;
    console.log(`detectSentences: processedText length=${processedText.length} (${text.length > maxChars ? 'truncated' : 'unchanged'})`);
    // Call AI API
    console.log(`detectSentences: Calling GROQ API [${new Date().toISOString()}]`);
    const apiStartTime = Date.now();
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are a sentence extraction expert. Extract resume bullet points and return ONLY a JSON array of strings. Do not include any explanatory text before or after the JSON array.'
          },
          {
            role: 'user',
            content: `Extract resume bullet points from the following text:\n\n${processedText}`
          }
        ],
        temperature: 0.2,
        max_tokens: 1024
      })
    });
    const apiEndTime = Date.now();
    console.log(`detectSentences: GROQ API call completed in ${apiEndTime - apiStartTime}ms`);
    console.log(`detectSentences: API response status=${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`detectSentences: GROQ API error [${response.status}]:`, errorText);
      throw new Error(`GROQ API error: ${response.status}`);
    }
    console.log('detectSentences: Parsing API response JSON');
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    // Log a small preview of the response
    console.log(`detectSentences: raw content from API (${content.length} chars) preview=`, content.length > 100 ? content.slice(0, 100) + '...' : content);
    // Robust parsing logic after receiving response
    console.log('detectSentences: Starting sentence extraction from response');
    const parseStartTime = Date.now();
    const sentences = extractSentencesFromResponse(content);
    const parseEndTime = Date.now();
    console.log(`detectSentences: Sentence extraction completed in ${parseEndTime - parseStartTime}ms`);
    console.log(`detectSentences: Found ${sentences.length} sentences`);
    // Display a few examples of extracted sentences
    if (sentences.length > 0) {
      console.log('detectSentences: Sample extracted sentences:');
      const sampleCount = Math.min(3, sentences.length);
      for(let i = 0; i < sampleCount; i++){
        console.log(`  [${i + 1}] ${sentences[i].substring(0, 80)}${sentences[i].length > 80 ? '...' : ''}`);
      }
      if (sentences.length > sampleCount) {
        console.log(`  ... and ${sentences.length - sampleCount} more`);
      }
    }
    // Save to database if userId is provided
    if (userId) {
      console.log(`detectSentences: Saving sentences to database for userId=${userId}`);
      const dbStartTime = Date.now();
      try {
        await saveSentencesToDatabase(userId, sentences);
        const dbEndTime = Date.now();
        console.log(`detectSentences: Database save completed in ${dbEndTime - dbStartTime}ms`);
      } catch (dbError) {
        console.error('detectSentences: Database save failed:', dbError);
        console.log('detectSentences: Continuing to return sentences despite database error');
      }
    }
    const endTime = Date.now();
    console.log(`detectSentences: Function completed in ${endTime - startTime}ms`);
    return sentences;
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`detectSentences: Error after ${errorTime}ms:`, error.message);
    if (error.stack) {
      console.error('detectSentences: Error stack:', error.stack);
    }
    throw error;
  }
}
// Helper function to extract sentences from the response with multiple fallback strategies
export function extractSentencesFromResponse(content) {
  console.log('extractSentencesFromResponse: Starting extraction');
  let sentences = [];
  // Try multiple extraction methods, from most structured to least
  // Method 1: Try direct JSON parsing if it looks like a JSON array
  console.log('extractSentencesFromResponse: Trying Method 1 - Direct JSON parsing');
  console.log(`extractSentencesFromResponse: Content starts with '[': ${content.trim().startsWith('[')}, ends with ']': ${content.trim().endsWith(']')}`);
  if (content.trim().startsWith('[') && content.trim().endsWith(']')) {
    try {
      const parsedArray = JSON.parse(content.trim());
      if (Array.isArray(parsedArray) && parsedArray.length > 0) {
        console.log(`extractSentencesFromResponse: Method 1 successful - parsed ${parsedArray.length} items`);
        sentences = parsedArray;
      } else {
        console.log('extractSentencesFromResponse: Method 1 parsed successfully but result is not a valid array or is empty');
      }
    } catch (e) {
      console.log(`extractSentencesFromResponse: Method 1 failed - ${e.message}`);
    // Continue to next method if this fails
    }
  } else {
    console.log('extractSentencesFromResponse: Method 1 skipped - content does not start/end with brackets');
  }
  // Method 2: Extract JSON array if embedded in text
  if (sentences.length === 0) {
    console.log('extractSentencesFromResponse: Trying Method 2 - JSON array extraction');
    console.log(`extractSentencesFromResponse: Content includes '[': ${content.includes('[')}, includes ']': ${content.includes(']')}`);
    if (content.includes('[') && content.includes(']')) {
      try {
        const jsonMatch = content.match(/\[\s*[\s\S]*\]/);
        if (jsonMatch) {
          console.log(`extractSentencesFromResponse: Method 2 - found potential JSON: ${jsonMatch[0].substring(0, 50)}...`);
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
        console.log(`extractSentencesFromResponse: Method 2 failed - ${e.message}`);
      // Continue to next method
      }
    } else {
      console.log('extractSentencesFromResponse: Method 2 skipped - content does not include brackets');
    }
  }
  // Method 3: Fix malformed JSON with double quotes issue
  if (sentences.length === 0) {
    console.log('extractSentencesFromResponse: Trying Method 3 - Fixing double quotes issue');
    console.log(`extractSentencesFromResponse: Content includes '""': ${content.includes('""')}`);
    if (content.includes('""')) {
      try {
        // Replace double quotes with single quotes and try to parse
        console.log('extractSentencesFromResponse: Method 3 - applying quote fixes to content');
        const fixedContent = content.replace(/\[\s*\n?/g, '[').replace(/\s*\n?\]/g, ']').replace(/""/g, '"').replace(/",\s*(?=\])/g, '"');
        console.log(`extractSentencesFromResponse: Method 3 - fixed content preview: ${fixedContent.substring(0, 50)}...`);
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
        console.log(`extractSentencesFromResponse: Method 3 failed - ${e.message}`);
      // Continue to next method
      }
    } else {
      console.log('extractSentencesFromResponse: Method 3 skipped - content does not include double quotes');
    }
  }
  // Method 4: Extract quoted strings individually
  if (sentences.length === 0) {
    console.log('extractSentencesFromResponse: Trying Method 4 - Individual string extraction');
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
    console.log(`extractSentencesFromResponse: Method 4 - found ${matchCount} regex matches, ${items.length} valid items`);
    if (items.length > 0) {
      console.log('extractSentencesFromResponse: Method 4 successful');
      sentences = items;
    } else {
      console.log('extractSentencesFromResponse: Method 4 failed - no valid items found');
    }
  }
  // Method 5: Handle doubly quoted strings (""text"") which appeared in the logs
  if (sentences.length === 0) {
    console.log('extractSentencesFromResponse: Trying Method 5 - Double-quote pattern extraction');
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
    console.log('extractSentencesFromResponse: Trying Method 6 - Line-by-line extraction (last resort)');
    const lines = content.split(/\r?\n/);
    console.log(`extractSentencesFromResponse: Method 6 - content split into ${lines.length} lines`);
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
function cleanAndDeduplicate(sentences) {
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
  console.log(`cleanAndDeduplicate: Cleaned ${cleanedCount}, dropped ${droppedCount} (too short), found ${duplicateCount} duplicates`);
  console.log(`cleanAndDeduplicate: Final unique sentence count: ${result.length}`);
  return result;
}
// Save extracted sentences to the most recent resume record of the user in DB
export async function saveSentencesToDatabase(userId, sentences) {
  console.log(`saveSentencesToUserLatestResume: Starting database save for user ${userId} with ${sentences.length} sentences`);
  const startTime = Date.now();
  // Initialize Supabase client inside the function with service role key
  const supabase = getSupabaseClient();
  try {
    // Find the most recent resume for this user
    console.log(`saveSentencesToUserLatestResume: Querying for most recent resume for user ${userId}`);
    const queryStartTime = Date.now();
    const { data: recentResumes, error: queryError } = await supabase.from('resumes').select('id, updated_at').eq('user_id', userId).order('updated_at', {
      ascending: false
    }).limit(1);
    const queryEndTime = Date.now();
    console.log(`saveSentencesToUserLatestResume: Query completed in ${queryEndTime - queryStartTime}ms`);
    if (queryError) {
      console.error('saveSentencesToUserLatestResume: Database query error:', queryError);
      throw queryError;
    }
    if (!recentResumes || recentResumes.length === 0) {
      console.error(`saveSentencesToUserLatestResume: No resumes found for user ${userId}`);
      throw new Error(`No resumes found for user ${userId}`);
    }
    const resumeId = recentResumes[0].id;
    const resumeUpdatedAt = recentResumes[0].updated_at;
    console.log(`saveSentencesToUserLatestResume: Found most recent resume ${resumeId} (last updated: ${resumeUpdatedAt})`);
    // Update the resume record with sentences and current timestamp
    console.log(`saveSentencesToUserLatestResume: Updating resume ${resumeId} with ${sentences.length} sentences`);
    const updateStartTime = Date.now();
    const { error: updateError } = await supabase.from('resumes').update({
      sentences: sentences,
      sentences_updated_at: new Date().toISOString()
    }).eq('id', resumeId);
    const updateEndTime = Date.now();
    console.log(`saveSentencesToUserLatestResume: Update completed in ${updateEndTime - updateStartTime}ms`);
    if (updateError) {
      console.error('saveSentencesToUserLatestResume: Database update error:', updateError);
      throw updateError;
    }
    // Verification after update
    const { data: verifyData, error: verifyError } = await supabase.from('resumes').select('sentences, sentences_updated_at').eq('id', resumeId).single();
    console.log('Verification after update:');
    console.log('  Data exists:', !!verifyData);
    console.log('  Sentences exists:', !!verifyData?.sentences);
    console.log('  Sentences count:', verifyData?.sentences?.length || 0);
    console.log('  Updated timestamp:', verifyData?.sentences_updated_at);
    console.log('  Verify error:', verifyError);
    const endTime = Date.now();
    console.log(`saveSentencesToUserLatestResume: Successfully saved ${sentences.length} sentences to resume ${resumeId}`);
    console.log(`saveSentencesToUserLatestResume: Total function execution time: ${endTime - startTime}ms`);
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`saveSentencesToUserLatestResume: Error after ${errorTime}ms:`, error.message);
    if (error.stack) {
      console.error('saveSentencesToUserLatestResume: Error stack:', error.stack);
    }
    throw error;
  }
}
// Update the function signature to accept userId
export async function extractAndSaveSentences(text, userId) {
  console.log(`extractAndSaveSentences: Starting for userId=${userId} with text length=${text.length}`);
  const startTime = Date.now();
  try {
    const sentences = await detectSentences(text, userId);
    const endTime = Date.now();
    console.log(`extractAndSaveSentences: Completed in ${endTime - startTime}ms, extracted ${sentences.length} sentences`);
    return sentences;
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`extractAndSaveSentences: Error after ${errorTime}ms:`, error.message);
    throw error;
  }
}
