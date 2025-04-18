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
    console.log("detectSentences: processedText length=", processedText.length);
    
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

    console.log("detectSentences: API responded with status", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("detectSentences: GROQ API error response body=", errorText);
      throw new Error(`GROQ API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    console.log("detectSentences: raw content from API=", content);
    
    // Parse JSON array from content
    let sentencesArray: string[] = [];
    try {
      // First pass
      sentencesArray = safeJsonParse(content, []);
      console.log("detectSentences: parsed sentencesArray=", sentencesArray);

      // Fallback: extract any JSON array substring
      if ((!Array.isArray(sentencesArray) || sentencesArray.length === 0) && content.includes('[')) {
        console.log("detectSentences: trying array fallback regex");
        const inside = content.match(/\[([\s\S]*)\]/);
        if (inside) {
          sentencesArray = safeJsonParse(inside[0], []);
          console.log("detectSentences: after fallback parse=", sentencesArray);
        }
      }
    } catch (e) {
      console.warn("detectSentences: Failed to parse JSON, error=", e);
      console.log("detectSentences: falling back to crude split of content");
      sentencesArray = content
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(s => s.length > 15 && !s.startsWith('- '));
      console.log("detectSentences: crude split result=", sentencesArray);
    }

    // Dedupe, filter and trim
    const unique = Array.from(new Set(
      sentencesArray
        .filter(s => typeof s === 'string' && s.trim().length > 15)
        .map(s => s.trim())
    ));
    console.log("detectSentences: final unique sentences=", unique);
    return unique;
  } catch (error) {
    console.error("detectSentences: error=", error);
    throw error;
  }
}
