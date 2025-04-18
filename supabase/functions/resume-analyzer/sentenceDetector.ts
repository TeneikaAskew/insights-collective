import { safeJsonParse, handleApiError } from './utils.ts';

// Function to detect sentences from resume text\ nexport async function detectSentences(text: string): Promise<string[]> {
  console.log('detectSentences: input text length=', text.length);
  try {
    const GROQ_API_KEY = Deno.env.get('GROQ');
    if (!GROQ_API_KEY) {
      console.warn("GROQ API key not found, falling back to regex extraction");
      throw new Error("GROQ API key not configured");
    }

    const maxChars = 12000;
    const processedText = text.length > maxChars ? text.substring(0, maxChars) : text;
    console.log('detectSentences: processedText length=', processedText.length);

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
            content: 'You are a sentence extraction expert. Identify resume bullet points and return them as a JSON array.'
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
      console.error("detectSentences: GROQ API error:", errorText);
      throw new Error(`GROQ API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('detectSentences: raw content from API=', content.slice(0, 200));

    let sentencesArray: string[] = [];
    let parsed = false;

    // Attempt direct JSON parse
    try {
      sentencesArray = safeJsonParse(content, []);
      console.log('detectSentences: parsed JSON array=', sentencesArray.length);
      parsed = Array.isArray(sentencesArray) && sentencesArray.length > 0;
    } catch (e) {
      console.warn('detectSentences: direct JSON.parse failed:', e.message);
    }

    // Fallback: extract first [...] block
    if (!parsed && content.includes('[')) {
      console.log('detectSentences: trying bracket fallback');
      const match = content.match(/\[([\s\S]*)\]/);
      if (match) {
        try {
          sentencesArray = safeJsonParse(match[0], []);
          console.log('detectSentences: bracket fallback parsed=', sentencesArray.length);
          parsed = sentencesArray.length > 0;
        } catch (e) {
          console.warn('detectSentences: bracket fallback parse failed:', e.message);
        }
      }
    }

    // Last‑ditch crude split
    if (!parsed) {
      console.warn('detectSentences: last‑ditch splitting');
      sentencesArray = content
        .split(/\r?\n/)        
        .map(s => s.trim())
        .filter(s => s.length > 15 && !s.startsWith('- '));
      console.log('detectSentences: crude split count=', sentencesArray.length);
    }

    // Deduplicate and final filter
    const unique = Array.from(new Set(sentencesArray))
      .filter(s => typeof s === 'string' && s.trim().length > 15)
      .map(s => s.trim());

    console.log('detectSentences: final unique sentences=', unique.length);
    return unique;

  } catch (error) {
    console.error('detectSentences: error in sentence detection:', error.message);
    throw error;
  }
}
