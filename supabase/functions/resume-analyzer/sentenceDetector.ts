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
          { role: 'system', content: 'You are a sentence extraction expert. Identify resume bullet points and return them as a JSON array.' },
          { role: 'user', content: `Extract resume bullet points from the following text:\n\n${processedText}` }
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

    let sentencesArray: string[] = [];
    let parsed = false;

    // 1) Direct JSON parse
    try {
      sentencesArray = safeJsonParse(content, []);
      console.log('detectSentences: direct parse count=', sentencesArray.length);
      parsed = Array.isArray(sentencesArray) && sentencesArray.length > 0;
    } catch (e) {
      console.warn('detectSentences: direct JSON.parse failed:', e.message);
    }

    // 2) Bracket fallback
    if (!parsed && content.includes('[')) {
      console.log('detectSentences: trying bracket fallback');
      const match = content.match(/\[([\s\S]*)\]/);
      if (match) {
        try {
          sentencesArray = safeJsonParse(match[0], []);
          console.log('detectSentences: bracket fallback count=', sentencesArray.length);
          parsed = sentencesArray.length > 0;
        } catch (e) {
          console.warn('detectSentences: bracket fallback parse failed:', e.message);
        }
      }
    }

    // 3) Last‑ditch crude split
    if (!parsed) {
      console.warn('detectSentences: last‑ditch splitting');
      sentencesArray = content
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(s => s.length > 15 && !s.startsWith('- '));
      console.log('detectSentences: crude split count=', sentencesArray.length);
    }

    // 4) Dedupe and final cleanup
    const unique = Array.from(new Set(sentencesArray))
      .filter(s => typeof s === 'string' && s.trim().length > 15)
      .map(s => s.trim());

    console.log('detectSentences: final unique count=', unique.length);
    return unique;

  } catch (error) {
    console.error('detectSentences: error in sentence detection:', error.message);
    throw error;
  }
}
