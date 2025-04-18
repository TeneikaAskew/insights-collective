console.log('Sentence Detection function hit');
import { safeJsonParse, handleApiError } from './utils.ts';

// Function to detect sentences from resume text
export async function detectSentences(text: string): Promise<string[]> {
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
    console.log('detectSentences: raw content from API=', content.slice(0, 200));
    
    // Improved parsing logic
    let sentencesArray: string[] = [];
    
    // Strategy 1: Direct JSON parse
    try {
      sentencesArray = JSON.parse(content);
      console.log('detectSentences: direct parse successful, count=', sentencesArray.length);
      if (Array.isArray(sentencesArray) && sentencesArray.length > 0) {
        // If we get here, parsing worked
        return processFinalSentences(sentencesArray);
      }
    } catch (e) {
      console.warn('detectSentences: direct JSON.parse failed:', e.message);
    }
    
    // Strategy 2: Find complete JSON array pattern
    try {
      const jsonMatch = content.match(/\[\s*".*"\s*(?:,\s*".*"\s*)*\]/s);
      if (jsonMatch) {
        sentencesArray = JSON.parse(jsonMatch[0]);
        console.log('detectSentences: pattern match parse successful, count=', sentencesArray.length);
        if (Array.isArray(sentencesArray) && sentencesArray.length > 0) {
          return processFinalSentences(sentencesArray);
        }
      }
    } catch (e) {
      console.warn('detectSentences: pattern match parse failed:', e.message);
    }
    
    // Strategy 3: Extract content between brackets and parse
    try {
      const bracketMatch = content.match(/\[([\s\S]*)\]/);
      if (bracketMatch) {
        // Add the brackets back for valid JSON
        const jsonStr = `[${bracketMatch[1]}]`;
        sentencesArray = JSON.parse(jsonStr);
        console.log('detectSentences: bracket extraction parse successful, count=', sentencesArray.length);
        if (Array.isArray(sentencesArray) && sentencesArray.length > 0) {
          return processFinalSentences(sentencesArray);
        }
      }
    } catch (e) {
      console.warn('detectSentences: bracket extraction parse failed:', e.message);
    }
    
    // Strategy 4: Try line-by-line parsing for quoted items
    const lines = content.split(/\r?\n/);
    const items: string[] = [];
    
    for (const line of lines) {
      // Look for quoted strings
      const matches = line.match(/"([^"]+)"/g);
      if (matches) {
        for (const match of matches) {
          try {
            // Parse each quoted string
            const parsed = JSON.parse(match);
            if (typeof parsed === 'string' && parsed.length > 15) {
              items.push(parsed);
            }
          } catch (e) {
            // Skip parsing errors
          }
        }
      }
    }
    
    if (items.length > 0) {
      console.log('detectSentences: line-by-line parsing successful, count=', items.length);
      return processFinalSentences(items);
    }
    
    // Last-ditch fallback: crude splitting by newlines
    console.warn('detectSentences: falling back to crude splitting');
    sentencesArray = content
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(s => s.length > 15 && !s.startsWith('- '));
    
    return processFinalSentences(sentencesArray);
  } catch (error) {
    console.error('detectSentences: error in sentence detection:', error.message);
    throw error;
  }
}

// Helper function to dedupe and clean up the final array
function processFinalSentences(sentences: string[]): string[] {
  const unique = Array.from(new Set(sentences))
    .filter(s => typeof s === 'string' && s.trim().length > 15)
    .map(s => s.trim().replace(/^["']|["']$/g, '')); // Remove quotes at start/end
  
  console.log('detectSentences: final unique count=', unique.length);
  return unique;
}