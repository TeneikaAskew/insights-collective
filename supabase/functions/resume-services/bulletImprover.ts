
import { corsHeaders } from "../resume-analyzer/utils.ts";

export interface BulletImprovement {
  original: string;
  rewritten: string;
  tips: string;
}

export interface BulletAnalysisInput {
  original: string;
  xyz_scores?: {
    hard_soft: number;
    action_words: number;
    measurable_results: number;
    clarity_focus: number;
    xyz_total?: number;
  };
  word_balance_score?: number;
  word_balance?: {
    industry_pct: number;
    common_pct: number;
    action_pct: number;
    metric_pct: number;
  };
}

// Function to improve bullet points using Groq
export function serveBulletImprover() {
  return async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const bulletAnalysis = await req.json() as BulletAnalysisInput;
      
      if (!bulletAnalysis?.original) {
        return new Response(
          JSON.stringify({ error: "Missing or invalid bullet point" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const improved = await improveBullet(bulletAnalysis);
      
      return new Response(
        JSON.stringify(improved),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (error) {
      console.error("Error in bullet improvement:", error.message);
      
      return new Response(
        JSON.stringify({ error: error.message || "Failed to improve bullet point" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  };
}

// Implementation of bullet improvement using Groq
export async function improveBullet(bulletAnalysis: BulletAnalysisInput): Promise<BulletImprovement> {
  const GROQ_API_KEY = Deno.env.get("GROQ");
  
  if (!GROQ_API_KEY) {
    console.warn("GROQ API key not set, falling back to simple bullet improvement");
    return simpleBulletImprovement(bulletAnalysis);
  }
  
  try {
    // Prepare the prompt with analysis details
    let prompt = `Improve this resume bullet point: "${bulletAnalysis.original}"\n\n`;
    
    // Add scores if available
    if (bulletAnalysis.xyz_scores) {
      prompt += "Current scores:\n";
      prompt += `- Hard & Soft Skills: ${bulletAnalysis.xyz_scores.hard_soft}/5\n`;
      prompt += `- Action Words: ${bulletAnalysis.xyz_scores.action_words}/5\n`;
      prompt += `- Measurable Results: ${bulletAnalysis.xyz_scores.measurable_results}/5\n`;
      prompt += `- Clarity & Focus: ${bulletAnalysis.xyz_scores.clarity_focus}/5\n`;
    }
    
    if (bulletAnalysis.word_balance) {
      prompt += "\nWord distribution:\n";
      prompt += `- Industry terms: ${bulletAnalysis.word_balance.industry_pct}%\n`;
      prompt += `- Common words: ${bulletAnalysis.word_balance.common_pct}%\n`;
      prompt += `- Action words: ${bulletAnalysis.word_balance.action_pct}%\n`;
      prompt += `- Metrics: ${bulletAnalysis.word_balance.metric_pct}%\n`;
    }
    
    prompt += "\nProvide the following:\n";
    prompt += "1. An improved version of the bullet point\n";
    prompt += "2. Specific tips for further improvement";
    
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
            content: "You are a professional resume writer who specializes in improving resume bullet points. You excel at making bullet points more impactful by starting with strong action verbs, incorporating industry keywords, and quantifying achievements with specific metrics. You make sure bullets are concise (20-25 words max) and focused on results. Your improvements maintain the original meaning but make them more impressive to hiring managers and ATS systems."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4,
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
    
    // Parse the response to extract the improved bullet and tips
    const sections = content.split(/\n\n|\r\n\r\n/);
    let rewritten = bulletAnalysis.original;
    let tips = "Consider starting with a strong action verb and including specific metrics.";
    
    for (const section of sections) {
      if (section.toLowerCase().includes("improved") || section.match(/^1\.\s/)) {
        const match = section.match(/(?:improved|1\.)\s*(?:version|bullet)?\s*:?\s*(.+)/i);
        if (match?.[1]) {
          rewritten = match[1].trim().replace(/^"/, '').replace(/"$/, '');
        } else {
          const lines = section.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/^(improved|1\.)/i) && i + 1 < lines.length) {
              rewritten = lines[i + 1].trim().replace(/^"/, '').replace(/"$/, '');
              break;
            }
          }
        }
      }
      
      if (section.toLowerCase().includes("tips") || section.match(/^2\.\s/)) {
        const match = section.match(/(?:tips|2\.)\s*(?:for further improvement)?\s*:?\s*(.+)/i);
        if (match?.[1]) {
          tips = match[1].trim();
        } else {
          const lines = section.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/^(tips|2\.)/i) && i + 1 < lines.length) {
              tips = lines[i + 1].trim();
              break;
            }
          }
        }
      }
    }
    
    return {
      original: bulletAnalysis.original,
      rewritten,
      tips
    };
  } catch (error) {
    console.error("Error calling GROQ API:", error);
    return simpleBulletImprovement(bulletAnalysis);
  }
}

// Fallback simple bullet improvement
function simpleBulletImprovement(bulletAnalysis: BulletAnalysisInput): BulletImprovement {
  const original = bulletAnalysis.original;
  let rewritten = original;
  let tips = "";
  
  // Basic improvements based on scores
  const scores = bulletAnalysis.xyz_scores || {
    hard_soft: 3,
    action_words: 3,
    measurable_results: 2,
    clarity_focus: 3
  };
  
  // Improve action words if needed
  if (scores.action_words < 4) {
    // Check if bullet starts with an action verb
    const actionVerbs = ["Achieved", "Implemented", "Developed", "Led", "Created", "Managed", "Designed", 
                        "Improved", "Increased", "Reduced", "Delivered", "Launched", "Generated", "Streamlined"];
    const firstWord = original.split(' ')[0];
    
    if (!actionVerbs.some(verb => firstWord.toLowerCase() === verb.toLowerCase())) {
      // Pick a random action verb
      const randomVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)];
      rewritten = `${randomVerb} ${original.charAt(0).toLowerCase() + original.slice(1)}`;
      tips += "Start with a strong action verb. ";
    }
  }
  
  // Add metrics if needed
  if (scores.measurable_results < 3 && !original.match(/\d+%|\$\d+|\d+ percent|\d+k|\d+M|\d+B/i)) {
    tips += "Add specific metrics to demonstrate your impact (%, $, numbers). ";
  }
  
  // Improve clarity if needed
  if (scores.clarity_focus < 3) {
    const words = rewritten.split(/\s+/);
    if (words.length > 25) {
      tips += "Make your bullet more concise, aim for 20-25 words maximum. ";
    }
  }
  
  // Add industry skill keywords if needed
  if (scores.hard_soft < 3) {
    tips += "Incorporate relevant industry keywords and technical skills. ";
  }
  
  if (!tips) {
    tips = "Your bullet point is already well-written. Consider adding more specific achievements if possible.";
  }
  
  return {
    original,
    rewritten,
    tips
  };
}
