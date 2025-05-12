
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

// Function to call LLM API with improved JSON extraction and error handling
async function callLLMAPI(resume: string, jobDescription: string) {
  try {
    const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
    
    if (!TOGETHER_API_KEY) {
      throw new Error('Together API key not found');
    }
    
    // Modify the prompt to emphasize JSON-only response
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
    
    IMPORTANT: Your entire response must be ONLY valid JSON with no additional text or explanation before or after the JSON. Do not include markdown code blocks or any other formatting. The response should begin with an opening curly brace and end with a closing curly brace.
    
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
    if (n > 131_072) {
      console.warn('🚨 exceeds max context! trim or chunk it.');
      // you could even throw here, or slice off part of the text
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
        temperature: 0.5, // Lower temperature for more deterministic JSON generation
        max_tokens: 2000,
        stop: ["\n\n"], // Stop generation at double newlines to prevent additional text
      }),
    });
    
    const result = await response.json();
    console.log("AI Response: ", result);
    
    if (!result.choices || !result.choices[0] || !result.choices[0].text) {
      throw new Error('Invalid response from Together AI');
    }
    
    // Get the raw text
    let text = result.choices[0].text.trim();
    console.log("Text from Choices: ", text);
    
    // Sanitize the text to extract only the JSON portion
    text = sanitizeJsonText(text);
    
    try {
      // Parse the sanitized JSON
      const analysisResult = JSON.parse(text);
      console.log("Successfully parsed JSON");
      return analysisResult;
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      
      // Try a more aggressive JSON extraction as a fallback
      try {
        const extractedJson = extractJsonObject(text);
        if (extractedJson) {
          console.log("Successfully extracted JSON using fallback method");
          return extractedJson;
        }
      } catch (extractError) {
        console.error('JSON extraction fallback failed:', extractError);
      }
      
      throw new Error('Failed to parse JSON from API response');
    }
  } catch (error) {
    console.error('LLM API call failed:', error);
    throw error;
  }
}

// Function to sanitize text to extract only the JSON portion
function sanitizeJsonText(text: string): string {
  // Remove any markdown code blocks and backticks
  text = text.replace(/```json/g, '').replace(/```/g, '');
  
  // Find first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  
  return text;
}

// Fallback function to extract JSON object from malformed text
function extractJsonObject(text: string): any {
  // Try regular expression to find a complete JSON object
  const jsonRegex = /(\{[\s\S]*\})/;
  const match = text.match(jsonRegex);
  
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      // If parsing fails, try to fix common JSON issues
      let jsonText = match[1];
      
      // Fix unescaped quotes within strings
      jsonText = fixUnescapedQuotes(jsonText);
      
      // Fix trailing commas
      jsonText = jsonText.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      
      return JSON.parse(jsonText);
    }
  }
  
  throw new Error('Could not extract valid JSON');
}

// Function to fix unescaped quotes within JSON strings
function fixUnescapedQuotes(text: string): string {
  // This is a simplistic approach - a more robust solution would use a proper JSON parser
  let inString = false;
  let result = '';
  let escaped = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '"' && !escaped) {
      inString = !inString;
    } else if (char === '\\') {
      escaped = true;
    } else {
      escaped = false;
    }
    
    // If we're inside a string and encounter an unescaped quote, escape it
    if (inString && char === '"' && text[i-1] !== '\\' && i > 0) {
      result += '\\';
    }
    
    result += char;
  }
  
  return result;
}

// Modified serve function with better error handling
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
    
    // Try to use the LLM API for analysis with retry logic
    let analysisResult: AnalysisResult;
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      try {
        analysisResult = await callLLMAPI(resumeText, jobDescription);
        // If we get here, the API call was successful
        break;
      } catch (apiError) {
        attempts++;
        console.error(`LLM API analysis attempt ${attempts} failed:`, apiError);
        
        if (attempts >= maxAttempts) {
          console.error('All LLM API attempts failed, falling back to basic analysis');
          // Fall back to basic keyword matching after all retries fail
          analysisResult = performBasicAnalysis(resumeText, jobDescription);
          break;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempts * 1000));
      }
    }
    
    // Validate the analysis result structure
    if (!validateAnalysisResult(analysisResult)) {
      console.warn('Analysis result failed validation, using fallback');
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

// Function to validate the analysis result has the correct structure
function validateAnalysisResult(result: any): boolean {
  try {
    // Check for required fields
    if (typeof result !== 'object' || 
        result === null || 
        typeof result.overallScore !== 'number' ||
        !Array.isArray(result.keywordMatches) || 
        !Array.isArray(result.missingKeywords) || 
        !Array.isArray(result.technicalSkills) || 
        !Array.isArray(result.functionalSkills) || 
        !Array.isArray(result.responsibilities) || 
        !Array.isArray(result.improvementSuggestions)) {
      return false;
    }
    
    // Check range for overallScore
    if (result.overallScore < 0 || result.overallScore > 100) {
      result.overallScore = Math.max(0, Math.min(100, result.overallScore));
    }
    
    return true;
  } catch (e) {
    console.error('Error validating analysis result:', e);
    return false;
  }
}

// // Function to call LLM API (OpenAI or Together AI, etc.)
// async function callLLMAPI(resume: string, jobDescription: string) {
//   // Implement your LLM API call here - this is a simplified example
//   try {
//     const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
    
//     if (!TOGETHER_API_KEY) {
//       throw new Error('Together API key not found');
//     }
    
//     const prompt = `
//     You are an AI resume analyzer specialized in matching resumes to job descriptions.
    
//     RESUME TEXT:
//     ${resume.slice(0, 4000)}
    
//     JOB DESCRIPTION:
//     ${jobDescription.slice(0, 2000)}
    
//     Please analyze how well the resume matches the job description according to the following criteria:
//     1. Calculate an overall compatibility score as a percentage (0-100)
//     2. Identify keywords from the job description and check if they appear in the resume
//     3. List keywords from the job description that are missing from the resume
//     4. Analyze technical skills required (with importance level high/medium/low) and check if they're in the resume
//     5. Analyze functional skills required (with importance level high/medium/low) and check if they're in the resume
//     6. Analyze responsibilities mentioned (with importance level high/medium/low) and check if they're addressed
//     7. Provide 5-7 specific suggestions for improving the resume for this job
    
//     Format your response as valid JSON with the following structure:
//     {
//       "overallScore": number,
//       "keywordMatches": [{"keyword": string, "frequency": number, "matched": boolean}],
//       "missingKeywords": [string],
//       "technicalSkills": [{"skill": string, "importance": "high"|"medium"|"low", "matched": boolean}],
//       "functionalSkills": [{"skill": string, "importance": "high"|"medium"|"low", "matched": boolean}],
//       "responsibilities": [{"skill": string, "importance": "high"|"medium"|"low", "matched": boolean}],
//       "improvementSuggestions": [string]
//     }
//     `;

//       const n = await countTokens(prompt, 'gpt-4o-mini');
//       console.log(`Prompt uses ${n} tokens`);
//       if (n > 131_072) {
//         console.warn('🚨 exceeds max context! trim or chunk it.');
//       // you could even throw here, or slice off part of `user`
//       }
//     const response = await fetch('https://api.together.xyz/v1/completions', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${TOGETHER_API_KEY}`,
//       },
//       body: JSON.stringify({
//         model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
//         prompt,
//         temperature: 0.7,
//         max_tokens: 2000,
//       }),
//     });
    
//     const result = await response.json();
//     console.log("AI Response: ", result)
    
//     if (!result.choices || !result.choices[0] || !result.choices[0].text) {
//       throw new Error('Invalid response from Together AI');
//     }
    
//     // Extract JSON from the response text
//     const text = result.choices[0].text.trim();
//     console.log("Text from Choices: ", text)
//     const jsonMatch = text.match(/\{[\s\S]*\}/);
//     console.log("JSON Match: ", jsonMatch)
    
//     if (!jsonMatch) {
//       throw new Error('Could not extract JSON from API response');
//     }
    
//     // Parse the JSON
//     try {
//       const analysisResult = JSON.parse(jsonMatch[0]);
//       console.log("Parsed JSON: ", analysisResult)
//       return analysisResult;
//     } catch (jsonError) {
//       console.error('JSON parsing error:', jsonError);
//       throw new Error('Failed to parse JSON from API response');
//     }
//   } catch (error) {
//     console.error('LLM API call failed:', error);
//     throw error;
//   }
// }

// Basic keyword extraction function (fallback if API fails)
function extractKeywords(text: string): string[] {
  // Remove common stopwords, convert to lowercase, split by non-word characters
  const stopwords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of']);
  const words = text.toLowerCase().split(/\W+/).filter(word => 
    word.length > 3 && !stopwords.has(word)
  );
  
  // Return unique words
  return Array.from(new Set(words));
}

// Count word occurrences
function countOccurrences(text: string, word: string): number {
  return (text.toLowerCase().match(new RegExp(`\\b${word.toLowerCase()}\\b`, 'g')) || []).length;
}

// Fallback analysis function
function performBasicAnalysis(resumeText: string, jobDescription: string): AnalysisResult {
  const resumeLower = resumeText.toLowerCase();
  const jobDescLower = jobDescription.toLowerCase();
  
  // Extract keywords from job description
  const keywords = extractKeywords(jobDescLower);
  
  // Match keywords with resume
  const keywordMatches = keywords.map(keyword => ({
    keyword,
    frequency: countOccurrences(jobDescLower, keyword),
    matched: resumeLower.includes(keyword.toLowerCase())
  }));
  
  // Get missing keywords
  const missingKeywords = keywords.filter(keyword => 
    !resumeLower.includes(keyword.toLowerCase())
  );
  
  // Calculate match percentage
  const matchedCount = keywordMatches.filter(k => k.matched).length;
  const matchPercentage = Math.round((matchedCount / keywords.length) * 100);
  
  // Generate simple skills lists
  const technicalSkills: SkillMatch[] = [
    'sql', 'python', 'javascript', 'java', 'react', 'angular', 'node', 'aws', 'azure', 'docker',
    'kubernetes', 'machine learning', 'data science', 'tableau', 'power bi'
  ].filter(skill => jobDescLower.includes(skill))
   .map(skill => ({
     skill,
     importance: countOccurrences(jobDescLower, skill) > 1 ? 'high' : 'medium',
     matched: resumeLower.includes(skill)
   }));
  
  const functionalSkills: SkillMatch[] = [
    'leadership', 'communication', 'presentation', 'strategy', 'analysis', 'project management',
    'team building', 'mentoring', 'collaboration', 'innovation', 'problem solving'
  ].filter(skill => jobDescLower.includes(skill))
   .map(skill => ({
     skill,
     importance: countOccurrences(jobDescLower, skill) > 1 ? 'high' : 'medium',
     matched: resumeLower.includes(skill)
   }));
  
  const responsibilities: SkillMatch[] = [
    'manage', 'develop', 'create', 'design', 'implement', 'analyze', 'lead', 'coordinate',
    'present', 'report', 'research', 'optimize', 'monitor'
  ].filter(resp => jobDescLower.includes(resp))
   .map(resp => ({
     skill: resp,
     importance: countOccurrences(jobDescLower, resp) > 2 ? 'high' : 'medium',
     matched: resumeLower.includes(resp)
   }));
  
  return {
    overallScore: Math.min(100, matchPercentage),
    keywordMatches,
    missingKeywords,
    technicalSkills,
    functionalSkills,
    responsibilities,
    improvementSuggestions: [
      "Add more keywords from the job description to your resume.",
      "Include specific metrics and achievements that match the job requirements.",
      "Tailor your professional summary to highlight relevant experience.",
      "Consider reorganizing your resume sections to prioritize relevant skills.",
      "Include industry-specific terminology found in the job description."
    ]
  };
}

// serve(async (req) => {
//   // Handle CORS for browser requests
//   if (req.method === 'OPTIONS') {
//     return new Response('ok', { headers: corsHeaders });
//   }
  
//   try {
//     // Parse request body
//     const requestData: AnalysisRequest = await req.json();
//     const { resumeText, jobDescription } = requestData;
    
//     // Validate input
//     if (!resumeText || !jobDescription) {
//       return new Response(
//         JSON.stringify({ error: 'Both resume text and job description are required' }),
//         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
//       );
//     }
    
//     // Try to use the LLM API for analysis
//     let analysisResult: AnalysisResult;
    
//     try {
//       analysisResult = await callLLMAPI(resumeText, jobDescription);
//     } catch (apiError) {
//       console.error('LLM API analysis failed, falling back to basic analysis:', apiError);
//       // Fall back to basic keyword matching
//       analysisResult = performBasicAnalysis(resumeText, jobDescription);
//     }
    
//     return new Response(
//       JSON.stringify(analysisResult),
//       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
//     );
    
//   } catch (error) {
//     console.error('Error processing request:', error);
    
//     return new Response(
//       JSON.stringify({ error: 'Failed to analyze resume-job compatibility' }),
//       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
//     );
//   }
// });
