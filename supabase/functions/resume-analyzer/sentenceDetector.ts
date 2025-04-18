console.log('Sentence Detection function hit');
import { safeJsonParse, handleApiError } from './utils.ts';
import { createClient } from '@supabase/supabase-js';

// Function to detect sentences from resume text and save to database
export async function detectSentences(text: string, resumeId?: string): Promise<string[]> {
  console.log('detectSentences: input text length=', text.length);
  try {
    const GROQ_API_KEY = Deno.env.get('GROQ');
    if (!GROQ_API_KEY) {
      console.warn("detectSentences: GROQ API key not found, falling back to regex extraction");
      throw new Error("GROQ API key not configured");
    }
    
    // Truncate to avoid token limits
    const maxChars = 12000;
    const processedText = text.length > maxChars ? text.substring(0, maxChars) : text;
    console.log('detectSentences: processedText length=', processedText.length);
    
    // Call AI API
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

    console.log(`detectSentences: API response status=`, response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('detectSentences: GROQ API error:', errorText);
      throw new Error(`GROQ API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Log a small preview of the response
    console.log('detectSentences: raw content from API=', content.slice(0, 100) + '...');
    
    // Robust parsing logic after receiving response
    const sentences = extractSentencesFromResponse(content);
    
    // Save to database if resumeId is provided
    if (resumeId) {
      await saveSentencesToDatabase(resumeId, sentences);
    }
    
    return sentences;
  } catch (error) {
    console.error('detectSentences: error in sentence detection:', error.message);
    throw error;
  }
}

// Helper function to extract sentences from the response with multiple fallback strategies
function extractSentencesFromResponse(content: string): string[] {
  let sentences: string[] = [];
  
  // Try multiple extraction methods, from most structured to least
  
  // Method 1: Try direct JSON parsing if it looks like a JSON array
  if (content.trim().startsWith('[') && content.trim().endsWith(']')) {
    try {
      const parsedArray = JSON.parse(content.trim());
      if (Array.isArray(parsedArray) && parsedArray.length > 0) {
        console.log('detectSentences: direct JSON parse successful');
        sentences = parsedArray;
      }
    } catch (e) {
      console.log('detectSentences: direct JSON parse failed:', e.message);
      // Continue to next method if this fails
    }
  }
  
  // Method 2: Extract JSON array if embedded in text
  if (sentences.length === 0 && content.includes('[') && content.includes(']')) {
    try {
      const jsonMatch = content.match(/\[\s*[\s\S]*\]/);
      if (jsonMatch) {
        const parsedArray = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsedArray) && parsedArray.length > 0) {
          console.log('detectSentences: JSON extraction successful');
          sentences = parsedArray;
        }
      }
    } catch (e) {
      console.log('detectSentences: JSON extraction failed:', e.message);
      // Continue to next method
    }
  }
  
  // Method 3: Fix malformed JSON with double quotes issue
  if (sentences.length === 0 && content.includes('""')) {
    try {
      // Replace double quotes with single quotes and try to parse
      const fixedContent = content
        .replace(/\[\s*\n?/g, '[')
        .replace(/\s*\n?\]/g, ']')
        .replace(/""/g, '"')
        .replace(/",\s*(?=\])/g, '"');
      
      // Try to extract array with fixed quotes
      const jsonMatch = fixedContent.match(/\[\s*[\s\S]*\]/);
      if (jsonMatch) {
        const parsedArray = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsedArray) && parsedArray.length > 0) {
          console.log('detectSentences: quote-fixed JSON extraction successful');
          sentences = parsedArray;
        }
      }
    } catch (e) {
      console.log('detectSentences: quote-fixed JSON extraction failed:', e.message);
      // Continue to next method
    }
  }
  
  // Method 4: Extract quoted strings individually
  if (sentences.length === 0) {
    const items: string[] = [];
    const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      if (match[1] && match[1].trim().length > 15) {
        items.push(match[1].trim());
      }
    }
    
    if (items.length > 0) {
      console.log('detectSentences: individual string extraction successful');
      sentences = items;
    }
  }
  
  // Method 5: Handle doubly quoted strings (""text"") which appeared in the logs
  if (sentences.length === 0) {
    const items: string[] = [];
    // This regex looks for patterns like ""text""
    const doubleQuotePattern = /""([^"]*)""(?:,|$)/g;
    let match;
    
    while ((match = doubleQuotePattern.exec(content)) !== null) {
      if (match[1] && match[1].trim().length > 15) {
        items.push(match[1].trim());
      }
    }
    
    if (items.length > 0) {
      console.log('detectSentences: double-quote extraction successful');
      sentences = items;
    }
  }
  
  // Method 6: Last resort - extract by lines
  if (sentences.length === 0) {
    console.log('detectSentences: falling back to line extraction');
    sentences = content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => {
        // Filter criteria for likely bullet points
        return line.length > 15 && 
               !line.startsWith('[') && 
               !line.startsWith(']') &&
               !line.includes('```');
      });
  }
  
  // Final cleanup and deduplication
  return cleanAndDeduplicate(sentences);
}

// Helper function to clean and deduplicate the extracted sentences
function cleanAndDeduplicate(sentences: string[]): string[] {
  const uniqueMap = new Map<string, string>();
  
  sentences.forEach(sentence => {
    if (typeof sentence === 'string') {
      // Clean the sentence
      let cleaned = sentence
        .trim()
        .replace(/^["']+|["']+$/g, '')  // Remove surrounding quotes
        .replace(/\\"/g, '"')           // Unescape quotes
        .replace(/\s+/g, ' ');          // Normalize whitespace
      
      // Store in map if it meets length criteria
      if (cleaned.length > 15) {
        // Use lowercase for deduplication key, but preserve original case
        const key = cleaned.toLowerCase();
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, cleaned);
        }
      }
    }
  });
  
  const result = Array.from(uniqueMap.values());
  console.log('detectSentences: final result count=', result.length);
  return result;
}

// Helper function to save sentences to the database
async function saveSentencesToDatabase(resumeId: string, sentences: string[]): Promise<void> {
  try {
    console.log(`saveSentencesToDatabase: Saving ${sentences.length} sentences for resume ${resumeId}`);
    
    // Get Supabase credentials from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Update the resume record with sentences
    const { error } = await supabase
      .from('resumes')
      .update({ 
        sentences: sentences,
        sentences_updated_at: new Date().toISOString()
      })
      .eq('id', resumeId);
    
    if (error) {
      console.error('saveSentencesToDatabase: Error updating resume:', error);
      throw error;
    }
    
    console.log(`saveSentencesToDatabase: Successfully saved sentences for resume ${resumeId}`);
  } catch (error) {
    console.error('saveSentencesToDatabase: Error saving to database:', error.message);
    throw error;
  }
}

// Update the function signature to accept resumeId
export async function extractAndSaveSentences(text: string, resumeId: string): Promise<string[]> {
  return detectSentences(text, resumeId);
}