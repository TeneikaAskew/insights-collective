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
    console.log(`detectSentences: processedText length= ${processedText.length}`);

    // Call AI extraction
    console.log("detectSentences: attempting AI extraction");
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

    console.log(`detectSentences: API responded with status ${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("detectSentences: GROQ API error body=", errorText);
      throw new Error(`GROQ API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("detectSentences: raw content from API=", data.choices?.[0]?.message?.content);
    const content = data.choices?.[0]?.message?.content || '[]';

    let sentencesArray: string[] = [];

    // Try JSON parse and bracket-extraction fallback
    try {
      sentencesArray = safeJsonParse(content, []);
      console.log("detectSentences: initial parsed sentencesArray=", sentencesArray);

      if (!Array.isArray(sentencesArray) || sentencesArray.length === 0) {
        console.log("detectSentences: trying array fallback regex");
        const arrayMatch = content.match(/\[([\s\S]*)\]/);
        if (arrayMatch) {
          sentencesArray = safeJsonParse(arrayMatch[0], []);
          console.log("detectSentences: parsed sentencesArray after regex=", sentencesArray);
        }
      }
    } catch (e) {
      console.error("detectSentences: Error parsing JSON arr, fallback to crude split=", e);
      const lines = content
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(s => s.length > 15);
      console.log("detectSentences: crude split lines=", lines);
      sentencesArray = lines;
    }

    // Final dedupe + filter
    const unique = Array.from(new Set(
      sentencesArray
        .filter(s => typeof s === 'string' && s.trim().length > 15)
        .map(s => s.trim())
    ));
    console.log("detectSentences: final unique sentences=", unique);
    return unique;

  } catch (error) {
    console.error("detectSentences: error in sentence detection=", error);
    throw error;
  }
}
