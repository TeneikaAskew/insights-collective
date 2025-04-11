
import { corsHeaders } from "../resume-analyzer/utils.ts";

// Function to detect sentences using Groq
export function serveSentenceDetector() {
  return async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const { text } = await req.json();
      
      if (!text || typeof text !== 'string') {
        return new Response(
          JSON.stringify({ error: "Missing or invalid text parameter" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const sentences = await detectSentences(text);
      
      return new Response(
        JSON.stringify(sentences),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (error) {
      console.error("Error in sentence detection:", error.message);
      
      return new Response(
        JSON.stringify({ error: error.message || "Failed to detect sentences" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  };
}

// Implementation of sentence detection using Groq or other API
export async function detectSentences(text: string): Promise<string[]> {
  const GROQ_API_KEY = Deno.env.get("GROQ");
  
  if (!GROQ_API_KEY) {
    console.warn("GROQ API key not set, falling back to simple sentence detection");
    return simpleSentenceDetection(text);
  }
  
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that extracts complete sentences from text content, focusing on professional achievements and experiences. Return only a list of complete sentences, no other text."
          },
          {
            role: "user",
            content: `Extract professional achievement sentences from the following resume text. Return ONLY the sentences, one per line, with no explanations, number or JSON:\n\n${text}`
          }
        ],
        temperature: 0.2,
        max_tokens: 1024
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("GROQ API error:", errorData);
      throw new Error(`GROQ API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Process the content to extract sentences
    const sentences = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.startsWith('-') && !line.match(/^\d+\./));
    
    return sentences;
  } catch (error) {
    console.error("Error calling GROQ API:", error);
    return simpleSentenceDetection(text);
  }
}

// Fallback simple sentence detection
function simpleSentenceDetection(text: string): string[] {
  if (!text) return [];
  
  // Remove common header/footer content
  const cleanedText = text
    .replace(/\b(?:phone|tel|email|address|website|linkedin|github):\s*[^\n]+/gi, '')
    .replace(/\b(?:education|skills|references|hobbies|interests)(?:\s*:|\s*$)/gi, '')
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\s+(?:-|to|–)\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\b/gi, '');
  
  // Split on periods followed by space then capital letter or line break
  const sentences = cleanedText
    .split(/(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\n+/g)
    .map(s => s.replace(/\r?\n/g, ' ').trim())
    .filter(s => s.length > 15)
    .filter(s => !s.match(/^\s*[•\-–—*]\s+/)) // Filter out bullet points
    .filter(s => !s.match(/^\s*\d+\.\s+/)); // Filter out numbered lists
    
  return sentences;
}
