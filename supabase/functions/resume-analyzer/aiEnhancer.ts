// ABOUTME: AI-powered resume enhancement using tool calling for structured output
// ABOUTME: Uses Lovable AI Gateway tool calling to extract elevator pitch, improvement themes, and grade explanation

import { corsHeaders, callLLMWithRetry } from './utils.ts';

// Tool definition for structured resume analysis output
const ANALYZE_RESUME_TOOL = {
  type: "function",
  function: {
    name: "analyze_resume",
    description: "Return structured resume analysis with elevator pitch, improvement themes, and grade explanation.",
    parameters: {
      type: "object",
      properties: {
        elevator_pitch: {
          type: "string",
          description: "Detailed professional elevator pitch summarizing the candidate's core expertise, key achievements, deployment experience, and professional passions. Should be 4-5 sentences and read like a polished introduction a recruiter could use."
        },
        themes: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 3,
          description: "Three specific improvement themes, one sentence each"
        },
        explanation: {
          type: "string",
          description: "Brief explanation of the resume grade, max 2 sentences"
        }
      },
      required: ["elevator_pitch", "themes", "explanation"],
      additionalProperties: false
    }
  }
};

const TOOL_CHOICE = { type: "function", function: { name: "analyze_resume" } };

// Use LLM API to enhance analysis with AI via tool calling
export async function enhanceWithGroq(resumeText: string, analysis: { bullets: any[]; letter_grade: string; resume_percent: number; [key: string]: any }) {
  console.log('Resume scoring and feedback function hit');
  const startTime = Date.now();
  try {
    const apiKey = Deno.env.get('GROQ');
    if (!apiKey) {
      throw new Error("GROQ API key not found");
    }
    // Limit the text to send to reduce token usage
    const maxResumeLength = 3000;
    const truncatedResume = resumeText.length > maxResumeLength ? resumeText.substring(50, maxResumeLength) + "..." : resumeText;
    console.log("Truncated Resume: ", truncatedResume);
    // For bullet analysis, just send a summary of the scores and most critical bullets
    // Select only high and low scoring bullets to give AI a sample of the range
    const sortedBullets = [
      ...analysis.bullets
    ].sort((a, b)=>b.bullet_total - a.bullet_total);
    const topBullets = sortedBullets.slice(0, 2); // 2 best bullets
    const bottomBullets = sortedBullets.slice(-2); // 2 worst bullets
    const selectedBullets = [
      ...topBullets,
      ...bottomBullets
    ];
    const bulletSummary = selectedBullets.map((b)=>{
      return {
        text: b.original.substring(0, 100),
        score: b.bullet_total,
        issues: (b.tips && typeof b.tips === 'string') ? b.tips.substring(0, 150) : ""
      };
    });
    console.log("Bullet Summary: ", bulletSummary);
    // Prepare a condensed version of the analysis
    const condensedAnalysis = {
      resume_percent: analysis.resume_percent,
      letter_grade: analysis.letter_grade,
      bullet_count: analysis.bullets.length,
      bullet_samples: bulletSummary,
      strong_bullets: topBullets.length > 0 ? topBullets.map((b)=>b.original.substring(0, 100)).join("\n") : "",
      weak_bullets: bottomBullets.length > 0 ? bottomBullets.map((b)=>b.original.substring(0, 100)).join("\n") : ""
    };
    console.log("Condensed Analysis:", JSON.stringify(condensedAnalysis, null, 2));

    // Call the LLM with tool calling for structured output
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(), 8000); // 8 second timeout

    try {
      const system = `You are an expert resume analyst. Based on the provided resume text and basic analysis, analyze the resume and call the analyze_resume function with:
1. A detailed professional elevator pitch (4-5 sentences) covering their core expertise, standout achievements, hands-on experience, and what drives them professionally
2. Three specific improvement themes (one sentence each)
3. A brief explanation of the resume grade (max 2 sentences)
Be specific, professional, and concise. Focus on actionable advice.`;

      const user = `Resume text (truncated): ${truncatedResume}\n\nBasic Analysis: ${JSON.stringify(condensedAnalysis)}`;

      const aiResponse = await callLLMWithRetry(system, user, 1, 3, "AI_ENHANCER", {
        tools: [ANALYZE_RESUME_TOOL],
        tool_choice: TOOL_CHOICE
      });
      clearTimeout(timeoutId);

      console.log("[AI_ENHANCER] Raw tool call response: ", aiResponse);

      // Parse the structured JSON from tool calling
      let extractedContent = { elevatorPitch: "", themes: [] as string[], explanation: "" };
      try {
        const parsed = typeof aiResponse === 'string' ? JSON.parse(aiResponse) : aiResponse;
        extractedContent = {
          elevatorPitch: parsed.elevator_pitch || "",
          themes: Array.isArray(parsed.themes) ? parsed.themes : [],
          explanation: parsed.explanation || ""
        };
      } catch (parseError) {
        console.error("[AI_ENHANCER] Failed to parse tool call response:", parseError);
        console.error("[AI_ENHANCER] Response was:", aiResponse);
      }

      console.log("[AI_ENHANCER] Extracted Content: ", extractedContent);

      // Update the analysis with AI-generated content
      const enhancedAnalysis = { ...analysis };

      if (extractedContent.elevatorPitch) {
        enhancedAnalysis.elevator_pitch = extractedContent.elevatorPitch;
        console.log("[AI_ENHANCER] Elevator pitch: ", enhancedAnalysis.elevator_pitch);
      }

      if (extractedContent.themes && extractedContent.themes.length > 0) {
        enhancedAnalysis.themes = extractedContent.themes.slice(0, 4);
        console.log("[AI_ENHANCER] Themes: ", extractedContent.themes);
      }

      if (extractedContent.explanation) {
        enhancedAnalysis.explanation = extractedContent.explanation;
        console.log("[AI_ENHANCER] Overall Explanation: ", enhancedAnalysis.explanation);
      }

      console.log("[AI_ENHANCER] Enhanced Analysis: ", enhancedAnalysis);
      const endTime = Date.now();
      console.log(`[enhanceWithGroq]: Function completed in ${(endTime - startTime)/1000}s`);
      return enhancedAnalysis;
    } catch (fetchError) {
      console.error("[AI_ENHANCER] API fetch error:", fetchError);
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error) {
    console.error("[AI_ENHANCER] Error enhancing analysis:", error);
    throw error;
  }
} // End of enhanceWithGroq function
