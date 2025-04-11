
import { corsHeaders } from "../index.ts";

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

// Helper function to safely parse JSON
export function safeJsonParse(text: string, fallback: any = {}) {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return fallback;
  }
}

// Function to improve bullet points using an AI service
export async function improveBullet(bullet: string): Promise<{
  improved: string;
  explanation: string;
}> {
  try {
    const GROQ_API_KEY = Deno.env.get('GROQ');
    if (!GROQ_API_KEY) {
      console.warn("GROQ API key not found, returning original bullet");
      return {
        improved: bullet,
        explanation: "Unable to improve bullet: GROQ API key not configured."
      };
    }
    
    // Prepare request to GROQ API
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
            content: `You are a resume bullet point improver that strengthens resume bullet points. 
            Make the bullet more impactful using the XYZ formula (Action, Context, Result). 
            Add specific metrics where possible. Keep the response to exactly two parts:
            1. The improved bullet (should be a single sentence)
            2. A brief explanation of what you changed and why it's better`
          },
          {
            role: 'user',
            content: `Original bullet: ${bullet}

            Respond with JSON in format:
            {
              "improved": "improved bullet text here",
              "explanation": "brief explanation here"
            }`
          }
        ],
        temperature: 0.4,
        max_tokens: 512
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GROQ API error:", errorText);
      throw new Error(`GROQ API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    // Parse the JSON response
    let result;
    try {
      result = safeJsonParse(content, { 
        improved: bullet,
        explanation: "Failed to parse improvement suggestion." 
      });
      
      // Verify the structure
      if (!result.improved || !result.explanation) {
        console.warn("Unexpected GROQ response format:", content);
        result = {
          improved: bullet,
          explanation: "Received invalid response format from improvement service."
        };
      }
    } catch (e) {
      console.error("Error parsing GROQ response:", e);
      result = {
        improved: bullet,
        explanation: "Failed to parse improvement suggestion."
      };
    }

    return result;
  } catch (error) {
    console.error("Error in bullet improvement:", error);
    return {
      improved: bullet,
      explanation: `Unable to improve: ${error.message || "Unknown error"}`
    };
  }
}

// Helper function to handle API errors
export function handleApiError(error: any, defaultMessage = "An error occurred") {
  console.error("API Error:", error);
  
  const message = error?.message || defaultMessage;
  return {
    error: true,
    message
  };
}

// Service handler for sentence detection
export function serveSentenceDetector() {
  return async (req: Request) => {
    try {
      const { text } = await req.json();
      
      if (!text || typeof text !== 'string') {
        return new Response(
          JSON.stringify({ error: "Missing or invalid text parameter" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const sentences = await detectSentences(text);
      
      return new Response(
        JSON.stringify({ sentences }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (error) {
      console.error("Error in sentence detector service:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to detect sentences" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  };
}

// Edge function handler for bullet improvement
export function serveBulletImprover() {
  return async (req: Request) => {
    try {
      // Parse request body
      const { bullet } = await req.json();
      
      if (!bullet || typeof bullet !== 'string') {
        return new Response(
          JSON.stringify({ error: "Missing or invalid bullet parameter" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Process the bullet improvement
      const result = await improveBullet(bullet);
      
      return new Response(
        JSON.stringify(result),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (error) {
      console.error("Error in bullet improver service:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to improve bullet" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  };
}
