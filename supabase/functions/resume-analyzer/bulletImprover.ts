
import { corsHeaders } from './utils.ts';

// Improve bullet points with GROQ
export async function improveBullet(data: {
  original: string;
  xyz_scores?: any;
  word_balance_score?: number;
  word_balance?: any;
}): Promise<{ rewritten: string; tips: string }> {
  try {
    const GROQ_API_KEY = Deno.env.get('GROQ');
    if (!GROQ_API_KEY) {
      console.warn("GROQ API key not found, falling back to basic bullet improvements");
      throw new Error("GROQ API key not configured");
    }

    const { original, xyz_scores = {}, word_balance_score = 0, word_balance = {} } = data;
    
    // Prepare the prompt for GROQ
    const systemPrompt = `You are a professional resume bullet point improver. Your job is to:
1. Rewrite the given bullet point to be more impactful
2. Start with strong action verbs
3. Include quantifiable metrics where possible
4. Ensure clarity and conciseness (20-25 words max)
5. Incorporate relevant technical or leadership skills
6. Provide specific tips for improvement

Return your response as a JSON object with two properties:
- rewritten: The improved bullet point text
- tips: Specific tips for further improving this bullet point`;

    const scores = JSON.stringify({
      xyz_scores: xyz_scores,
      word_balance_score: word_balance_score,
      word_balance: word_balance
    });

    const userPrompt = `Original bullet: "${original}"\n\nScores (0-10 scale): ${scores}\n\nPlease improve this bullet point and provide tips.`;
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 512
      })
    });

    if (!response.ok) {
      throw new Error(`GROQ API error: ${response.status}`);
    }

    const data_response = await response.json();
    const content = data_response.choices?.[0]?.message?.content || '{}';
    
    // Try to parse the JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      console.error("Error parsing GROQ response:", e);
      
      // Try to extract JSON if the response isn't valid JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          console.error("Failed to extract JSON from response:", e2);
        }
      }
    }
    
    if (!result || !result.rewritten) {
      return {
        rewritten: original,
        tips: "Unable to improve this bullet point. Consider adding more specific details and metrics."
      };
    }
    
    return {
      rewritten: result.rewritten,
      tips: result.tips || "Consider adding more quantifiable metrics and specific accomplishments."
    };
  } catch (error) {
    console.error("Error in bullet improvement:", error);
    // Return the original with basic tips
    return {
      rewritten: data.original,
      tips: "Try adding specific metrics and starting with a strong action verb."
    };
  }
}

// Service handler for bullet improvement
export function serveBulletImprover() {
  return async (req: Request) => {
    try {
      const data = await req.json();
      
      if (!data.original || typeof data.original !== 'string') {
        return new Response(
          JSON.stringify({ error: "Missing or invalid original bullet" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const improved = await improveBullet(data);
      
      return new Response(
        JSON.stringify(improved),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (error) {
      console.error("Error in bullet improver service:", error);
      return new Response(
        JSON.stringify({ 
          error: error.message || "Failed to improve bullet",
          rewritten: data?.original || "",
          tips: "Service error. Try using more specific language and metrics."
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  };
}
