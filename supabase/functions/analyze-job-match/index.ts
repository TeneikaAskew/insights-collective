// Supabase Edge Function for job skills analysis only
// File path: supabase/functions/analyze-job-skills/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/utils.ts';
import { requireUser } from '../_shared/auth.ts';
// Simple token estimation without external dependency
function countTokens(text: string): number {
  // Approximate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}
// Function to call LLM API specifically for skills and suggestions analysis
async function callLLMForSkillsAnalysis(resume: string, jobDescription: string, preCalculatedKeywords: { matchedKeywords: string[]; missingKeywords: string[] }) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not found');
  }
  // Create a prompt specifically for skills analysis, not keyword matching
  const prompt = `
  You are an AI resume analyzer specialized in matching resumes to job descriptions.
  
  RESUME TEXT:
  ${resume.slice(0, 4000)}
  
  JOB DESCRIPTION:
  ${jobDescription.slice(0, 2000)}
  
  THE KEYWORD MATCHING HAS ALREADY BEEN DONE, with these results:
  - Matched keywords: ${preCalculatedKeywords.matchedKeywords.join(', ')}
  - Missing keywords: ${preCalculatedKeywords.missingKeywords.join(', ')}
  
  Please analyze how well the resume matches the job description according to the following criteria:
  1. Identify the technical skills required in the job description (with importance level high/medium/low) and check if they appear in the resume
  2. Identify the functional/soft skills required (with importance level high/medium/low) and check if they appear in the resume
  3. Identify key responsibilities mentioned (with importance level high/medium/low) and check if they're addressed in the resume
  4. Provide 5-7 specific suggestions for improving the resume for this job
  
  DO NOT REPEAT THE KEYWORD ANALYSIS as it has already been done.
  
  OUTPUT REQUIREMENTS:
  - Return ONLY valid JSON without any additional text, explanation, code, or markdown
  - Do NOT start your response with "SAMPLE OUTPUT:" or any other prefix
  - The response should begin with an opening curly brace and end with a closing curly brace
  - No triple backticks, no json tags, no code blocks
  - No conversational text before or after the JSON object
  - Only a standard JSON object with no trailing characters
  
  Use exactly this JSON structure:
  {
    "technicalSkills": [{"skill": string, "importance": "high"|"medium"|"low", "matched": boolean}],
    "functionalSkills": [{"skill": string, "importance": "high"|"medium"|"low", "matched": boolean}],
    "responsibilities": [{"skill": string, "importance": "high"|"medium"|"low", "matched": boolean}],
    "improvementSuggestions": [string]
  }
  `;
  const n = countTokens(prompt);
  console.log(`Prompt uses ${n} tokens`);
  const model = 'google/gemini-2.5-flash';
  console.log(`Using model: ${model}`);
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LOVABLE_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant that provides JSON responses."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 2000
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI gateway error:', response.status, errorText);
    throw new Error(`AI gateway returned ${response.status}`);
  }
  const result = await response.json();
  console.log("AI Response: ", result);
  // *** FIXED: Updated to handle the chat completion response format ***
  if (!result.choices || result.choices.length === 0 || !result.choices[0].message || !result.choices[0].message.content) {
    throw new Error('Invalid response from Together AI');
  }
  // Get the content from the message
  const rawText = result.choices[0].message.content.trim();
  console.log("Raw text length:", rawText.length);
  // Extract and clean JSON
  const cleanedJson = extractCleanJson(rawText);
  console.log("Cleaned JSON length:", cleanedJson.length);
  try {
    // Parse the cleaned JSON
    const skillsAnalysis = JSON.parse(cleanedJson);
    return skillsAnalysis;
  } catch (jsonError) {
    console.error("JSON parsing error:", jsonError instanceof Error ? jsonError.message : String(jsonError));
    throw jsonError;
  }
}
// Helper function to clean JSON from LLM response
function extractCleanJson(text: string) {
  // First try to find JSON between curly braces
  let jsonText = text;
  // Remove markdown formatting
  jsonText = jsonText.replace(/```json|```|`/g, '');
  // Find the first opening brace and last closing brace
  const firstBrace = jsonText.indexOf('{');
  const lastBrace = jsonText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonText = jsonText.substring(firstBrace, lastBrace + 1);
  }
  // Fix common JSON issues
  jsonText = jsonText.replace(/,\s*}/g, '}'); // Remove trailing commas in objects
  jsonText = jsonText.replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
  return jsonText;
}
// BEHAVIOR CHANGE (silent-failure audit): the old createDefaultResponse helper
// returned empty skills arrays with the error buried inside
// "improvementSuggestions" — a 200 response indistinguishable in shape from a
// real analysis. Failures now return an explicit non-2xx error payload; the
// client (JobDescriptionAnalyzer) already has a local-analysis fallback wired
// to the error path.
// Main serve function
serve(async (req)=>{
  // Handle CORS for browser requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  // Deployed with verify_jwt=false: an unauthenticated, uncapped LLM endpoint.
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    // Parse request body
    const requestData = await req.json();
    const { resumeText, jobDescription, preCalculatedKeywords } = requestData;
    // Validate input
    if (!resumeText || !jobDescription || !preCalculatedKeywords) {
      return new Response(JSON.stringify({
        error: 'Resume text, job description, and pre-calculated keywords are required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    try {
      // Call LLM API for skills analysis
      const skillsAnalysis = await callLLMForSkillsAnalysis(resumeText, jobDescription, preCalculatedKeywords);
      return new Response(JSON.stringify(skillsAnalysis), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (apiError) {
      const apiErrorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      console.error("API or parsing error:", apiErrorMessage);
      // Upstream AI failure: report it honestly instead of a canned "analysis"
      return new Response(JSON.stringify({
        error: `AI skills analysis failed: ${apiErrorMessage}`
      }), {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({
      error: 'Request processing error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});