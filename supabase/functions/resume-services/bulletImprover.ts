
import { safeJsonParse, handleApiError } from '../resume-analyzer/utils.ts';

// Type for the bullet improvement parameters
interface BulletImproverParams {
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

// Response type
interface BulletImproverResponse {
  rewritten: string;
  tips: string;
}

// Improve a bullet point using GROQ
export async function improveBullet(params: BulletImproverParams): Promise<BulletImproverResponse> {
  try {
    const GROQ_API_KEY = Deno.env.get('GROQ');
    if (!GROQ_API_KEY) {
      console.warn("GROQ API key not found, falling back to basic rewrite");
      throw new Error("GROQ API key not configured");
    }

    const { original, xyz_scores, word_balance_score, word_balance } = params;
    
    // Create a summary of current scores and areas for improvement
    const improvementNeeds = [];
    if (xyz_scores.hard_soft < 3) improvementNeeds.push("add more specific technical skills or leadership traits");
    if (xyz_scores.action_words < 3) improvementNeeds.push("use stronger action verbs and avoid passive voice");
    if (xyz_scores.measurable_results < 3) improvementNeeds.push("include quantifiable results (%, $, metrics)");
    if (xyz_scores.clarity_focus < 3) improvementNeeds.push("make more concise and focused (aim for 25 words)");
    if (word_balance.industry_pct < 20) improvementNeeds.push("include more industry-specific terms");
    if (word_balance.action_pct < 10) improvementNeeds.push("increase use of strong action words");
    if (word_balance.metric_pct < 5) improvementNeeds.push("add more quantifiable metrics");
    
    const improvementSummary = improvementNeeds.length > 0 
      ? `Areas to improve: ${improvementNeeds.join(", ")}.` 
      : "This is already a strong bullet, but consider minor enhancements for clarity and impact.";

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
            content: `You are an expert resume writer specializing in improving resume bullet points. You will analyze a resume bullet and improve it, focusing on clarity, measurable impact, and professional phrasing. Return a JSON object with two fields: "rewritten" (the improved bullet) and "tips" (concise advice for further refinement). 

Current scores:
- Hard/Soft Skills: ${xyz_scores.hard_soft}/5
- Action Words: ${xyz_scores.action_words}/5
- Measurable Results: ${xyz_scores.measurable_results}/5
- Clarity & Focus: ${xyz_scores.clarity_focus}/5
- Word Balance Score: ${word_balance_score}/25

Word distribution:
- Industry Terms: ${word_balance.industry_pct}%
- Common Words: ${word_balance.common_pct}%
- Action Words: ${word_balance.action_pct}%
- Metrics: ${word_balance.metric_pct}%

${improvementSummary}`
          },
          {
            role: 'user',
            content: `Improve this resume bullet point:\n\n"${original}"\n\nReturn only valid JSON with "rewritten" and "tips" fields.`
          }
        ],
        temperature: 0.3,
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
    let result: BulletImproverResponse;
    try {
      result = safeJsonParse(content, { rewritten: original, tips: "Could not generate improvements." });
      
      // If parsing failed or resulted in incorrect format, try to extract JSON from content
      if (!result.rewritten || !result.tips) {
        const jsonMatch = content.match(/\{.*\}/s);
        if (jsonMatch) {
          const extractedJson = safeJsonParse(jsonMatch[0], { rewritten: original, tips: "Could not generate improvements." });
          if (extractedJson.rewritten && extractedJson.tips) {
            result = extractedJson;
          }
        }
      }
    } catch (e) {
      console.error("Error parsing GROQ response:", e);
      throw new Error("Failed to parse bullet improvement result");
    }

    return {
      rewritten: result.rewritten || original,
      tips: result.tips || "Consider improving this bullet point by adding more specificity, metrics, and stronger action verbs."
    };
  } catch (error) {
    console.error("Error in bullet improvement:", error);
    // Provide a default response when GROQ fails
    return {
      rewritten: params.original,
      tips: "Consider using stronger action verbs, adding measurable results, and being more concise."
    };
  }
}
