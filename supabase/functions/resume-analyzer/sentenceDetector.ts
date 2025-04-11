
import { safeJsonParse, handleApiError } from './utils.ts';

// Function to detect sentences from resume text
export async function detectSentences(text: string): Promise<string[]> {
  try {
    const GROQ_API_KEY = Deno.env.get('GROQ');
    if (!GROQ_API_KEY) {
      console.warn("GROQ API key not found, falling back to regex extraction");
      throw new Error("GROQ API key not configured");
    }

    // Prepare text - truncate if too long to avoid token limits
    const maxChars = 12000; // Safety limit
    const processedText = text.length > maxChars ? text.substring(0, maxChars) : text;
    
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
            content: 'You are a sentence extraction expert. Identify resume bullet points from the provided text and return them as a JSON array. Focus on action-oriented sentences describing achievements, responsibilities, and experiences. Filter out headers, dates, personal info, and other non-achievement text. Return only a JSON array of strings with no additional text.'
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GROQ API error:", errorText);
      throw new Error(`GROQ API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    // Parse the JSON array - look for array in content or just parse content directly
    let sentencesArray: string[] = [];
    try {
      // First try to parse the whole content as JSON array
      sentencesArray = safeJsonParse(content, []);
      
      // If not an array or empty, try to find a JSON array within the content
      if (!Array.isArray(sentencesArray) || sentencesArray.length === 0) {
        const arrayMatch = content.match(/\[.*\]/s);
        if (arrayMatch) {
          sentencesArray = safeJsonParse(arrayMatch[0], []);
        }
      }
    } catch (e) {
      console.error("Error parsing GROQ response:", e);
      throw new Error("Failed to parse sentence extraction result");
    }

    // Filter and clean up sentences
    return sentencesArray
      .filter(s => typeof s === 'string' && s.trim().length > 15)
      .map(s => s.trim());
  } catch (error) {
    console.error("Error in sentence detection:", error);
    throw error;
  }
}
