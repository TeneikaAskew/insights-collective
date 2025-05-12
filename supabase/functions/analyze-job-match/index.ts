
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

// Function to call LLM API (OpenAI or Together AI, etc.)
async function callLLMAPI(resume: string, jobDescription: string) {
  // Implement your LLM API call here - this is a simplified example
  try {
    const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
    
    if (!TOGETHER_API_KEY) {
      throw new Error('Together API key not found');
    }
    
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
    
    Format your response as valid JSON with the following structure:
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
      if (n > 131_072) {
        console.warn('🚨 exceeds max context! trim or chunk it.');
      // you could even throw here, or slice off part of `user`
      }
    const response = await fetch('https://api.together.xyz/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        prompt,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });
    
    const result = await response.json();
    console.log("AI Response: ", result)
    
    if (!result.choices || !result.choices[0] || !result.choices[0].text) {
      throw new Error('Invalid response from Together AI');
    }
    
    // Extract JSON from the response text
    const text = result.choices[0].text.trim();
    console.log("Text from Choices: ", text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    console.log("JSON Match: ", jsonMatch)
    
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from API response');
    }
    
    // Parse the JSON
    try {
      const analysisResult = JSON.parse(jsonMatch[0]);
      console.log("Parsed JSON: ", analysisResult)
      return analysisResult;
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      throw new Error('Failed to parse JSON from API response');
    }
  } catch (error) {
    console.error('LLM API call failed:', error);
    throw error;
  }
}

// // Basic keyword extraction function (fallback if API fails)
// function extractKeywords(text: string): string[] {
//   // Remove common stopwords, convert to lowercase, split by non-word characters
//   const stopwords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of']);
//   const words = text.toLowerCase().split(/\W+/).filter(word => 
//     word.length > 3 && !stopwords.has(word)
//   );
  
//   // Return unique words
//   return Array.from(new Set(words));
// }

// // Count word occurrences
// function countOccurrences(text: string, word: string): number {
//   return (text.toLowerCase().match(new RegExp(`\\b${word.toLowerCase()}\\b`, 'g')) || []).length;
// }

// // Fallback analysis function
// function performBasicAnalysis(resumeText: string, jobDescription: string): AnalysisResult {
//   const resumeLower = resumeText.toLowerCase();
//   const jobDescLower = jobDescription.toLowerCase();
  
//   // Extract keywords from job description
//   const keywords = extractKeywords(jobDescLower);
  
//   // Match keywords with resume
//   const keywordMatches = keywords.map(keyword => ({
//     keyword,
//     frequency: countOccurrences(jobDescLower, keyword),
//     matched: resumeLower.includes(keyword.toLowerCase())
//   }));
  
//   // Get missing keywords
//   const missingKeywords = keywords.filter(keyword => 
//     !resumeLower.includes(keyword.toLowerCase())
//   );
  
//   // Calculate match percentage
//   const matchedCount = keywordMatches.filter(k => k.matched).length;
//   const matchPercentage = Math.round((matchedCount / keywords.length) * 100);
  
//   // Generate simple skills lists
//   const technicalSkills: SkillMatch[] = [
//     'sql', 'python', 'javascript', 'java', 'react', 'angular', 'node', 'aws', 'azure', 'docker',
//     'kubernetes', 'machine learning', 'data science', 'tableau', 'power bi'
//   ].filter(skill => jobDescLower.includes(skill))
//    .map(skill => ({
//      skill,
//      importance: countOccurrences(jobDescLower, skill) > 1 ? 'high' : 'medium',
//      matched: resumeLower.includes(skill)
//    }));
  
//   const functionalSkills: SkillMatch[] = [
//     'leadership', 'communication', 'presentation', 'strategy', 'analysis', 'project management',
//     'team building', 'mentoring', 'collaboration', 'innovation', 'problem solving'
//   ].filter(skill => jobDescLower.includes(skill))
//    .map(skill => ({
//      skill,
//      importance: countOccurrences(jobDescLower, skill) > 1 ? 'high' : 'medium',
//      matched: resumeLower.includes(skill)
//    }));
  
//   const responsibilities: SkillMatch[] = [
//     'manage', 'develop', 'create', 'design', 'implement', 'analyze', 'lead', 'coordinate',
//     'present', 'report', 'research', 'optimize', 'monitor'
//   ].filter(resp => jobDescLower.includes(resp))
//    .map(resp => ({
//      skill: resp,
//      importance: countOccurrences(jobDescLower, resp) > 2 ? 'high' : 'medium',
//      matched: resumeLower.includes(resp)
//    }));
  
//   return {
//     overallScore: Math.min(100, matchPercentage),
//     keywordMatches,
//     missingKeywords,
//     technicalSkills,
//     functionalSkills,
//     responsibilities,
//     improvementSuggestions: [
//       "Add more keywords from the job description to your resume.",
//       "Include specific metrics and achievements that match the job requirements.",
//       "Tailor your professional summary to highlight relevant experience.",
//       "Consider reorganizing your resume sections to prioritize relevant skills.",
//       "Include industry-specific terminology found in the job description."
//     ]
//   };
// }

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
    
    // Try to use the LLM API for analysis
    let analysisResult: AnalysisResult;
    
    try {
      analysisResult = await callLLMAPI(resumeText, jobDescription);
    } catch (apiError) {
      console.error('LLM API analysis failed, falling back to basic analysis:', apiError);
      // Fall back to basic keyword matching
      analysisResult = performBasicAnalysis(resumeText, jobDescription);
    }
    
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
