
import { corsHeaders } from "../resume-analyzer/utils.ts";

const GROQ_API_KEY = Deno.env.get('GROQ');

// Interface for bullet analysis input
interface BulletAnalysisInput {
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

// Function to improve a bullet point using GROQ
export async function improveBullet(bullet: BulletAnalysisInput): Promise<{ rewritten: string; tips: string }> {
  if (!bullet?.original) {
    return { 
      rewritten: bullet?.original || "", 
      tips: "Unable to improve without valid bullet point text."
    };
  }
  
  try {
    // Call GROQ API for advanced bullet improvement
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
            content: `You are an expert resume writer specializing in crafting impactful bullet points. You analyze and improve resume bullets based on these criteria:
            
            1. Hard & Soft Skills: Specific technical skills or leadership traits
            2. Action Words: Strong action verbs at the beginning of bullets
            3. Measurable Results: Quantifiable achievements with metrics (%, $, etc.)
            4. Clarity & Focus: Concise writing (25 words or fewer)
            
            Each criterion is scored from 0-5, with 5 being the best. The word balance should show:
            - Industry terms: ~35-40%
            - Action words: ~15-20%
            - Metric terms: ~15-20%
            - Common words: The remainder
            
            Your goal is to improve the bullet point by addressing its weaknesses.`
          },
          {
            role: "user",
            content: `Here's a resume bullet point with its analysis:

            Original bullet: "${bullet.original}"
            
            Current scores:
            - Hard & Soft Skills: ${bullet.xyz_scores.hard_soft}/5
            - Action Words: ${bullet.xyz_scores.action_words}/5
            - Measurable Results: ${bullet.xyz_scores.measurable_results}/5 
            - Clarity & Focus: ${bullet.xyz_scores.clarity_focus}/5
            
            Current word balance:
            - Industry terms: ${bullet.word_balance.industry_pct}% (target: ~35-40%)
            - Action words: ${bullet.word_balance.action_pct}% (target: ~15-20%)
            - Metric terms: ${bullet.word_balance.metric_pct}% (target: ~15-20%)
            - Common words: ${bullet.word_balance.common_pct}%
            
            Please provide:
            1. A rewritten version of this bullet that addresses its weaknesses
            2. 2-3 specific tips for improving this bullet point
            
            Return your response in valid JSON format only:
            {
              "rewritten": "The improved bullet point text",
              "tips": "2-3 specific improvement tips"
            }`
          }
        ],
        temperature: 0.4,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GROQ API error: ${response.status} ${errorText}`);
      return fallbackImproveBullet(bullet);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      // Try to parse the JSON response
      const improvement = JSON.parse(content);
      return {
        rewritten: improvement.rewritten || bullet.original,
        tips: improvement.tips || generateFallbackTips(bullet)
      };
    } catch (parseError) {
      console.error("Error parsing GROQ response:", parseError);
      return fallbackImproveBullet(bullet);
    }
  } catch (error) {
    console.error("Error calling GROQ API:", error);
    return fallbackImproveBullet(bullet);
  }
}

// Fallback function if GROQ API is unavailable
function fallbackImproveBullet(bullet: BulletAnalysisInput): { rewritten: string; tips: string } {
  // Simple rewriting logic
  let rewritten = bullet.original;
  
  // If the bullet lacks action words
  if (bullet.xyz_scores.action_words < 3) {
    const actionWords = ["Developed", "Implemented", "Delivered", "Achieved", "Improved", 
                        "Spearheaded", "Led", "Pioneered", "Orchestrated", "Transformed"];
    const randomAction = actionWords[Math.floor(Math.random() * actionWords.length)];
    
    if (!/^[A-Z][a-z]+/.test(rewritten)) {
      rewritten = `${randomAction} ${rewritten.charAt(0).toLowerCase() + rewritten.slice(1)}`;
    }
  }
  
  // If lacking metrics
  if (bullet.xyz_scores.measurable_results < 3 && !rewritten.match(/\d+%|\$\d+/)) {
    rewritten += ", resulting in 20% improvement in efficiency";
  }
  
  // Generate fallback tips
  const tips = generateFallbackTips(bullet);
  
  return { rewritten, tips };
}

// Generate tips based on analysis
function generateFallbackTips(bullet: BulletAnalysisInput): string {
  const tips = [];
  
  if (bullet.xyz_scores.hard_soft < 3) {
    tips.push("Add more specific technical skills or leadership traits");
  }
  
  if (bullet.xyz_scores.action_words < 3) {
    tips.push("Start with a stronger action verb");
  }
  
  if (bullet.xyz_scores.measurable_results < 3) {
    tips.push("Include quantifiable results (%, $, or other metrics)");
  }
  
  if (bullet.xyz_scores.clarity_focus < 3) {
    tips.push("Make this more concise, aiming for 25 words or fewer");
  }
  
  return tips.join(". ") || "Consider adding more specificity to strengthen this bullet point.";
}

// Serve the function as an API endpoint
export function serveBulletImprover() {
  return async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      const bullet = await req.json();
      
      if (!bullet?.original) {
        return new Response(
          JSON.stringify({ error: "No valid bullet analysis provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const improvement = await improveBullet(bullet);
      
      return new Response(
        JSON.stringify(improvement),
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
