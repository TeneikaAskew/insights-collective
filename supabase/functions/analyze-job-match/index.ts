
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, callLLMWithRetry } from "../resume-analyzer/utils.ts";

interface JobMatchRequest {
  jobDescription: string;
  resumeText: string;
}

interface SkillMatch {
  skill: string;
  found: boolean;
  importance: 'high' | 'medium' | 'low';
}

interface JobAnalysis {
  technicalSkills: SkillMatch[];
  functionalSkills: SkillMatch[];
  responsibilities: SkillMatch[];
  overallScore: number;
  suggestions: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobDescription, resumeText }: JobMatchRequest = await req.json();
    
    if (!jobDescription || !resumeText) {
      return new Response(
        JSON.stringify({ error: "Job description and resume text are required" }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Truncate inputs to avoid token limits
    const truncatedJobDescription = jobDescription.length > 2500 
      ? jobDescription.substring(0, 2500) + "..." 
      : jobDescription;
    
    const truncatedResumeText = resumeText.length > 2500 
      ? resumeText.substring(0, 2500) + "..." 
      : resumeText;
    
    // Prepare the system prompt
    const systemPrompt = `You are an ATS (Applicant Tracking System) expert analyzing how well a resume matches a job description.
    You will extract important elements from the job description and check if they appear in the resume.
    Return a JSON object with the following structure:
    {
      "technicalSkills": [{"skill": "skill name", "found": boolean, "importance": "high|medium|low"}],
      "functionalSkills": [{"skill": "skill name", "found": boolean, "importance": "high|medium|low"}],
      "responsibilities": [{"skill": "verb or responsibility", "found": boolean, "importance": "high|medium|low"}],
      "overallScore": number (0-100),
      "suggestions": ["suggestion 1", "suggestion 2", ...]
    }
    
    Technical skills are hard skills, tools, technologies, and domain knowledge.
    Functional skills are soft skills, methodologies, and role-specific abilities.
    Responsibilities are duties and actions expected in the role.
    
    For each item, determine if it appears in the resume (found: true/false) and its importance (high/medium/low) based on emphasis and frequency in the job description.
    Calculate an overall compatibility score (0-100).
    Provide 3-5 specific suggestions to improve resume compatibility.`;

    // Prepare the user prompt
    const userPrompt = `Job Description:
    ${truncatedJobDescription}
    
    Resume:
    ${truncatedResumeText}
    
    Analyze how well this resume matches the job requirements and provide the results in the requested JSON format.`;

    try {
      // Call the LLM API and parse the response
      const llmResponse = await callLLMWithRetry(systemPrompt, userPrompt);
      
      // Extract the JSON response
      let jsonMatch = llmResponse.match(/```json\n([\s\S]*?)\n```/);
      let analysisData: JobAnalysis;
      
      if (jsonMatch && jsonMatch[1]) {
        // If JSON is wrapped in code blocks
        analysisData = JSON.parse(jsonMatch[1]);
      } else {
        // Try to parse the entire response as JSON
        try {
          analysisData = JSON.parse(llmResponse);
        } catch (parseError) {
          // If not valid JSON, extract anything that looks like a JSON object
          const possibleJson = llmResponse.match(/\{[\s\S]*\}/);
          if (possibleJson) {
            analysisData = JSON.parse(possibleJson[0]);
          } else {
            throw new Error("Could not parse LLM response as JSON");
          }
        }
      }
      
      // Return the analyzed data
      return new Response(
        JSON.stringify(analysisData), 
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    } catch (llmError) {
      console.error("LLM analysis error:", llmError);
      throw new Error("Failed to analyze with AI: " + llmError.message);
    }
  } catch (error) {
    console.error("Error in analyze-job-match function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
