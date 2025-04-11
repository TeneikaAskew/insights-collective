
import { corsHeaders } from "../resume-analyzer/utils.ts";

const GROQ_API_KEY = Deno.env.get('GROQ');

// Function to detect sentences in a block of text using GROQ
export async function detectSentences(text: string): Promise<string[]> {
  if (!text) return [];
  
  try {
    // Call GROQ API for advanced sentence detection
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: "You are an expert in natural language processing. Your task is to accurately split a given text into individual sentences. Pay attention to context and maintain the meaning of each sentence."
          },
          {
            role: "user",
            content: `Split the following text into individual sentences. Return only a JSON array of strings, with each string being a complete sentence. Do not include any explanations or notes.\n\n${text}`
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GROQ API error: ${response.status} ${errorText}`);
      return fallbackSentenceDetection(text);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      // Try to parse the JSON response
      const sentences = JSON.parse(content);
      if (Array.isArray(sentences)) {
        return sentences.filter(s => s && typeof s === 'string' && s.trim().length > 0);
      }
    } catch (parseError) {
      console.error("Error parsing GROQ response:", parseError);
      // If GROQ returned text but not valid JSON, try to extract sentences manually
      const matches = content.match(/\["([^"]+)"(?:,\s*"([^"]+)")*\]/);
      if (matches) {
        const extracted = matches[0].replace(/[\[\]"]/g, '').split(',').map(s => s.trim());
        if (extracted.length > 0) {
          return extracted;
        }
      }
    }
    
    // Fallback to basic sentence detection if GROQ failed
    return fallbackSentenceDetection(text);
  } catch (error) {
    console.error("Error calling GROQ API:", error);
    return fallbackSentenceDetection(text);
  }
}

// Fallback function if GROQ API is unavailable
function fallbackSentenceDetection(text: string): string[] {
  if (!text) return [];
  
  // Basic regex to split by sentence endings (., !, ?)
  // This is a simplified approach and won't handle all edge cases
  const sentences = text
    .replace(/([.!?])\s*(?=[A-Z])/g, "$1|") // Mark sentence boundaries
    .split("|")                             // Split on markers
    .map(s => s.trim())                     // Trim each sentence
    .filter(s => s.length > 0);             // Remove empty strings
  
  return sentences;
}

// Serve the function as an API endpoint
export function serveSentenceDetector() {
  return async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      const { text } = await req.json();
      
      if (!text) {
        return new Response(
          JSON.stringify({ error: "No text provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const sentences = await detectSentences(text);
      
      return new Response(
        JSON.stringify({ sentences }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  };
}
