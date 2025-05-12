// Supabase Edge Function for resume-job matching analysis
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/utils.ts';
import { encoding_for_model } from 'npm:@dqbd/tiktoken';

async function countTokens(text, model = 'gpt-4o-mini') {
  const enc = await encoding_for_model(model);
  const tokenCount = enc.encode(text).length;
  enc.free();
  return tokenCount;
}

// Custom types for our analyzer
interface AnalysisRequest {
  resumeText: string;
  jobDescription: string;
}

interface SkillMatch {
  skill: string;
  importance: 'high' | 'medium' | 'low';
  matched: boolean;
}

interface KeywordMatch {
  keyword: string;
  frequency: number;
  matched: boolean;
}

interface AnalysisResult {
  overallScore: number;
  keywordMatches: KeywordMatch[];
  missingKeywords: string[];
  technicalSkills: SkillMatch[];
  functionalSkills: SkillMatch[];
  responsibilities: SkillMatch[];
  improvementSuggestions: string[];
}

// Function to call LLM API with improved JSON extraction
async function callLLMAPI(resume: string, jobDescription: string) {
  const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
  
  if (!TOGETHER_API_KEY) {
    throw new Error('Together API key not found');
  }
  
  // Create a prompt with strict JSON-only instructions
  const prompt = `
  You are an AI resume analyzer specialized in matching resumes to job descriptions.
  
  RESUME TEXT:
  ${resume.slice(0, 4000)}
  
  JOB DESCRIPTION:
  ${jobDescription.slice(0, 2000)}
  
  Please analyze how well the resume matches the job description according to the following criteria:
  1. Calculate an overall compatibility score as a percentage (0-100)
  2. Identify keywords from the job description and check if they appear in the resume
  3. List keywords from the job description that are missing from the resume
  4. Analyze technical skills required (with importance level high/medium/low) and check if they're in the resume
  5. Analyze functional skills required (with importance level high/medium/low) and check if they're in the resume
  6. Analyze responsibilities mentioned (with importance level high/medium/low) and check if they're addressed
  7. Provide 5-7 specific suggestions for improving the resume for this job
  
  CRITICAL: Your entire response must be ONLY valid JSON with no additional text, explanation, code, or markdown. The response should begin with an opening curly brace and end with a closing curly brace.
  
  Use exactly this JSON structure:
  {
    "overallScore": number,
    "keywordMatches": [{"keyword": string, "frequency": number, "matched": boolean}],
    "missingKeywords": [string],
    "technicalSkills": [{"skill": string, "importance": "high"|"medium"|"low", "matched": boolean}],
    "functionalSkills": [{"skill": string, "importance": "high"|"medium"|"low", "matched": boolean}],
    "responsibilities": [{"skill": string, "importance": "high"|"medium"|"low", "matched": boolean}],
    "improvementSuggestions": [string]
  }
  `;

  const n = await countTokens(prompt, 'gpt-4o-mini');
  console.log(`Prompt uses ${n} tokens`);
  
  // Use the Llama 3.3 70B model (free and better at structured output)
  const model = 'mistralai/Mixtral-8x7B-Instruct-v0.1'; //'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free';
  console.log(`Using model: ${model}`);
  
  const response = await fetch('https://api.together.xyz/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOGETHER_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      temperature: 0.3, // Very low temperature for consistent JSON
      max_tokens: 2000,
      stop: ["\n\n", "```"], // Stop generation at double newlines or code blocks
    }),
  });
  
  const result = await response.json();
  
  if (!result.choices || !result.choices[0] || !result.choices[0].text) {
    throw new Error('Invalid response from Together AI');
  }
  
  // Get the raw text and clean it
  let text = result.choices[0].text.trim();
  
  // Remove any markdown code blocks and backticks
  text = text.replace(/```json/g, '').replace(/```/g, '');
  
  // Find first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }
  
  // Parse the JSON
  const analysisResult = JSON.parse(text);
  return analysisResult;
}

serve(async (req) => {
  // Handle CORS for browser requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Parse request body
    const requestData: AnalysisRequest = await req.json();
    const { resumeText, jobDescription } = requestData;
    
    // Validate input
    if (!resumeText || !jobDescription) {
      return new Response(
        JSON.stringify({ error: 'Both resume text and job description are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Call the LLM API directly with no fallbacks
    const analysisResult = await callLLMAPI(resumeText, jobDescription);
    
    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({ error: 'Failed to analyze resume-job compatibility' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});