
// Supabase Edge Function for job skills analysis only
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/utils.ts';
import { encoding_for_model } from 'npm:@dqbd/tiktoken';

async function countTokens(text, model = 'gpt-4o-mini') {
  const enc = await encoding_for_model(model);
  const tokenCount = enc.encode(text).length;
  enc.free();
  return tokenCount;
}

// Function to call LLM API specifically for skills and suggestions analysis
async function callLLMForSkillsAnalysis(resume, jobDescription, preCalculatedKeywords) {
  const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
  if (!TOGETHER_API_KEY) {
    throw new Error('Together API key not found');
  }

  // Filter job description for EEO statements before analysis
  const filteredJobDescription = filterEEOStatements(jobDescription);
  
  // Create a prompt specifically for skills analysis, not keyword matching
  const prompt = `
  You are an AI resume analyzer specialized in matching resumes to job descriptions.
  
  RESUME TEXT:
  ${resume.slice(0, 4000)}
  
  JOB DESCRIPTION:
  ${filteredJobDescription.slice(0, 2000)}
  
  THE KEYWORD MATCHING HAS ALREADY BEEN DONE, with these results:
  - Matched keywords: ${preCalculatedKeywords.matchedKeywords.join(', ')}
  - Missing keywords: ${preCalculatedKeywords.missingKeywords.join(', ')}
  
  IMPORTANT: Ignore any Equal Employment Opportunity (EEO) statements, legal hiring language, discrimination clauses, and company boilerplate text. Focus only on the actual job skills, responsibilities, and qualifications.
  
  Please analyze how well the resume matches the job description according to the following criteria:
  1. Identify the technical skills required in the job description (with importance level high/medium/low) and check if they appear in the resume
  2. Identify the functional/soft skills required (with importance level high/medium/low) and check if they appear in the resume
  3. Identify key responsibilities mentioned (with importance level high/medium/low) and check if they're addressed in the resume
  4. Provide 5-7 specific suggestions for improving the resume for this job
  
  DO NOT REPEAT THE KEYWORD ANALYSIS as it has already been done.
  DO NOT INCLUDE any EEO-related terms, legal hiring statements, or company culture boilerplate in your analysis.
  
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
  const n = await countTokens(prompt, 'gpt-4o-mini');
  console.log(`Prompt uses ${n} tokens`);

  // Use Mixtral or Llama model based on availability
  const model = 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free';
  console.log(`Using model: ${model}`);

  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOGETHER_API_KEY}`
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

  const result = await response.json();
  console.log("AI Response: ", result);

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
    console.error("JSON parsing error:", jsonError.message);
    throw jsonError;
  }
}

// Function to filter out EEO statements from job descriptions
function filterEEOStatements(text) {
  // Common EEO statement patterns
  const eeoPatterns = [
    /equal.*opportunity.*employer/i,
    /eeo|eeoc/i,
    /discriminat(e|ion|ing|ory)/i,
    /protect(ed)?\s*(class|status|veteran|characteristics)/i,
    /diversity.*inclusion/i,
    /inclusion.*diversity/i,
    /affirmative\s*action/i,
    /(regard|irrespective|regardless)\s*of\s*(race|gender|religion|age|disability|orientation)/i,
    /we\s*(are|provide)\s*an\s*equal\s*opportunity/i,
    /qualified\s*(applicants|candidates)/i,
    /without\s*regard\s*to/i,
    /prohibit(s|ed)?\s*discrimination/i
  ];
  
  // Split text into paragraphs
  const paragraphs = text.split(/\n\n|\r\n\r\n/);
  
  // Filter out paragraphs that match EEO patterns
  const filteredParagraphs = paragraphs.filter(paragraph => {
    return !eeoPatterns.some(pattern => pattern.test(paragraph));
  });
  
  return filteredParagraphs.join('\n\n');
}

// Helper function to clean JSON from LLM response
function extractCleanJson(text) {
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

// Create a default response for error cases
function createDefaultResponse(errorMessage) {
  return {
    technicalSkills: [],
    functionalSkills: [],
    responsibilities: [],
    improvementSuggestions: [
      "An error occurred while analyzing your resume: " + errorMessage,
      "Please try again or use the manual keyword matching to guide your resume updates."
    ]
  };
}

// Main serve function
serve(async (req)=>{
  // Handle CORS for browser requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

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
      console.error("API or parsing error:", apiError.message);
      // Return a default response that won't break the client
      const defaultResponse = createDefaultResponse(apiError.message);
      return new Response(JSON.stringify(defaultResponse), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    // Return a default response for general errors
    const defaultResponse = createDefaultResponse("Request processing error");
    return new Response(JSON.stringify(defaultResponse), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
