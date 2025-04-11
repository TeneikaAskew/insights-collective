
import { safeJsonParse, handleApiError } from '../resume-analyzer/utils.ts';

interface BulletImprovement {
  rewritten: string;
  tips: string;
}

interface BulletData {
  original: string; 
  xyz_scores: {
    hard_soft: number;
    action_words: number;
    measurable_results: number;
    clarity_focus: number;
  };
  word_balance_score: number;
  word_balance: {
    industry_pct: number;
    common_pct: number;
    action_pct: number;
    metric_pct: number;
  };
}

// Improve bullet points using GROQ
export async function improveBullet(bullet: BulletData): Promise<BulletImprovement> {
  try {
    const GROQ_API_KEY = Deno.env.get('GROQ');
    if (!GROQ_API_KEY) {
      console.warn("GROQ API key not found, bullet improvement will be limited");
      throw new Error("GROQ API key not configured");
    }

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
            content: `You are a resume writing expert. Analyze and improve bullet points to make them more impactful and professional.
            Focus on:
            1. Strong action verbs
            2. Measurable achievements
            3. Technical skills and leadership qualities
            4. Clarity and conciseness
            Return ONLY a JSON object with two fields:
            - "rewritten": the improved bullet point
            - "tips": specific improvement suggestions for the original`
          },
          {
            role: 'user',
            content: `Improve this resume bullet point:
            
Original: "${bullet.original}"

Current scores:
- Hard/Soft Skills: ${bullet.xyz_scores.hard_soft}/5
- Action Words: ${bullet.xyz_scores.action_words}/5
- Measurable Results: ${bullet.xyz_scores.measurable_results}/5
- Clarity & Focus: ${bullet.xyz_scores.clarity_focus}/5
- Word Balance Score: ${bullet.word_balance_score}/25
- Industry terms: ${bullet.word_balance.industry_pct}%
- Common words: ${bullet.word_balance.common_pct}%
- Action words: ${bullet.word_balance.action_pct}%
- Metric terms: ${bullet.word_balance.metric_pct}%

Please rewrite this bullet to improve its impact focusing on the weakest areas identified above. Return only a JSON with "rewritten" and "tips" fields.`
          }
        ],
        temperature: 0.3,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GROQ API error:", errorText);
      throw new Error(`GROQ API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    let improvement: BulletImprovement;
    try {
      // Try to parse the content as JSON directly
      improvement = safeJsonParse(content, {
        rewritten: bullet.original,
        tips: "No specific improvement suggestions available."
      });
      
      // If fields are missing, look for JSON object in content
      if (!improvement.rewritten || !improvement.tips) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedJson = safeJsonParse(jsonMatch[0], {
            rewritten: bullet.original,
            tips: "No specific improvement suggestions available."
          });
          if (extractedJson.rewritten) {
            improvement = extractedJson;
          }
        }
      }
    } catch (e) {
      console.error("Error parsing GROQ response:", e);
      throw new Error("Failed to parse bullet improvement result");
    }

    return {
      rewritten: improvement.rewritten || bullet.original,
      tips: improvement.tips || "No specific improvement suggestions available."
    };
  } catch (error) {
    console.error("Error in bullet improvement:", error);
    return {
      rewritten: bullet.original,
      tips: "Consider improving this bullet with more specific achievements and stronger action verbs."
    };
  }
}

// Helper service function to expose endpoint
export function serveBulletImprover() {
  return async (req: Request) => {
    try {
      const bulletData = await req.json();
      
      if (!bulletData || !bulletData.original) {
        return new Response(
          JSON.stringify({ error: "Missing or invalid bullet data" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const improvement = await improveBullet(bulletData);
      
      return new Response(
        JSON.stringify(improvement),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error in bullet improver service:", error);
      return new Response(
        JSON.stringify({ 
          error: error.message || "Failed to improve bullet",
          rewritten: bulletData?.original || "",
          tips: "Our system encountered an error while generating improvements."
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };
}
