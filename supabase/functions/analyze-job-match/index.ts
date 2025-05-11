
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Export comprehensive CORS headers for use across the application
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};

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

// Import directly from npm modules for token counting
import { encoding_for_model } from "npm:@dqbd/tiktoken";
async function countTokens(text: string, model = 'gpt-4o-mini') {
  const enc = await encoding_for_model(model);
  const tokenCount = enc.encode(text).length;
  enc.free();
  return tokenCount;
}

// Track failed endpoints globally - persist across function calls
const failedEndpoints: Record<string, number> = {
  ANWAN: 0,
  GROQ: 0,
  TOGETHER: 0
};

// Maximum failures before skipping an endpoint
const MAX_FAILURES = 4;

// Function to check if an endpoint should be skipped
function shouldSkipEndpoint(endpoint: string): boolean {
  return (failedEndpoints[endpoint] || 0) >= MAX_FAILURES;
}

// Function to record a failure for an endpoint
function recordEndpointFailure(endpoint: string, isDailyLimit: boolean = false): void {
  if (isDailyLimit) {
    failedEndpoints[endpoint] = MAX_FAILURES;
    console.log(`${endpoint} has reached daily rate limit - skipping for the rest of the session`);
  } else {
    failedEndpoints[endpoint] = (failedEndpoints[endpoint] || 0) + 1;
    console.log(`${endpoint} failure count: ${failedEndpoints[endpoint]}/${MAX_FAILURES}`);
  }
}

/**
 * callLLMAPI
 * • tries available endpoints in order based on their failure status
 * • skips endpoints that have failed more than MAX_FAILURES times
 *
 * @param system      System-role instructions (what the assistant "is")
 * @param user        User-role prompt (what you want it to do)
 */
async function callLLMAPI(
  system: string,
  user: string
): Promise<string> {
  // Try endpoints in order of preference, skipping any that have exceeded failure threshold
  const combined = [
    `system: ${system}`,
    `user: ${user}`
  ].join('\n\n');
  const n = await countTokens(combined, 'gpt-4o-mini');
  console.log(`Prompt uses ${n} tokens`);
  if (n > 131_072) {
    console.warn('🚨 exceeds max context! trim or chunk it.');
  }
  
  if (!shouldSkipEndpoint('ANWAN')) {
    try {
      return await callANWANAPI(system, user);
    } catch (error) {
      console.error('ANWAN API failed:', error.message);
      // Check for daily rate limit message
      const isDailyLimit = error.message.includes('per day') || 
                          error.message.includes('daily limit') || 
                          error.message.includes('wait 24 hours');
      
      // Only increment failure counter for rate limits or serious errors
      if ((error as any).status === 429 || (error as any).status >= 500) {
        recordEndpointFailure('ANWAN', isDailyLimit);
      }
    }
  }

  if (!shouldSkipEndpoint('GROQ')) {
    try {
      return await callGROQAPI(system, user);
    } catch (error) {
      console.error('GROQ API failed:', error.message);
      // Check for daily rate limit message
      const isDailyLimit = error.message.includes('per day') || 
                          error.message.includes('daily limit') || 
                          error.message.includes('wait 24 hours');
      
      if ((error as any).status === 429 || (error as any).status >= 500) {
        recordEndpointFailure('GROQ', isDailyLimit);
      }
    }
  }

  if (!shouldSkipEndpoint('TOGETHER')) {
    try {
      return await callTOGETHERAPI(system, user);
    } catch (error) {
      console.error('TOGETHER API failed:', error.message);
      // Check for daily rate limit message
      const isDailyLimit = error.message.includes('per day') || 
                          error.message.includes('daily limit') || 
                          error.message.includes('wait 24 hours') ||
                          error.message.includes('quota');
      
      if ((error as any).status === 429 || (error as any).status >= 500) {
        recordEndpointFailure('TOGETHER', isDailyLimit);
      }
    }
  }

  // If we reached here, all viable endpoints failed
  throw new Error('All LLM endpoints failed or are disabled due to past failures');
}

// ANWAN API call
async function callANWANAPI(system: string, user: string): Promise<string> {
  const ANWAN_API_KEY = Deno.env.get('ANWAN');
  if (!ANWAN_API_KEY) throw new Error('ANWAN API key not found in environment');

  const anwanUrl = 'https://api.awanllm.com/v1/chat/completions';
  
  const resp = await fetch(anwanUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANWAN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'Meta-Llama-3-8B-Instruct',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    // Store the full response text to check for daily limit patterns
    const error = new Error(`ANWAN API failed: ${resp.status} ${txt}`);
    // @ts-ignore - Adding status property to Error object
    error.status = resp.status;
    throw error;
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content;
}

// GROQ API call
async function callGROQAPI(system: string, user: string): Promise<string> {
  const GROQ_API_KEY = Deno.env.get('GROQ');
  if (!GROQ_API_KEY) throw new Error('GROQ API key not found in environment');

  const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  
  const resp = await fetch(groqUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'compound-beta-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    const error = new Error(`GROQ API failed: ${resp.status} ${txt}`);
    // @ts-ignore - Adding status property to Error object
    error.status = resp.status;
    throw error;
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content;
}

// TOGETHER API call
async function callTOGETHERAPI(system: string, user: string): Promise<string> {
  const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
  if (!TOGETHER_API_KEY) throw new Error('TOGETHER API key not found in environment');

  const togetherUrl = 'https://api.together.xyz/v1/chat/completions';
  
  const resp = await fetch(togetherUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOGETHER_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    const error = new Error(`TOGETHER API failed: ${resp.status} ${txt}`);
    // @ts-ignore - Adding status property to Error object
    error.status = resp.status;
    throw error;
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content;
}

/**
 * callLLMWithRetry
 * • wraps callLLMAPI in exponential-backoff retry
 *
 * @param system      System-role instructions
 * @param user        User-role prompt
 * @param attempt     (internal) current retry number
 * @param maxAttempts Maximum retries before giving up
 */
async function callLLMWithRetry(
  system: string,
  user: string,
  attempt = 1,
  maxAttempts = 4
): Promise<string> {
  try {
    console.log(`callLLMWithRetry: Attempt ${attempt}/${maxAttempts}`);
    return await callLLMAPI(system, user);
  } catch (err: any) {
    if (attempt < maxAttempts) {
      // exponential backoff
      let waitMs = 1000 * Math.pow(2, attempt);

      // if error says "try again in Xs"
      const m = err.message.match(/try again in (\d+.?\d*)s/i);
      if (m) {
        waitMs = Math.ceil(parseFloat(m[1]) * 1000) + 500;
        console.log(`Extracted wait=${waitMs}ms from error message`);
      }

      // jitter
      waitMs += Math.floor(Math.random() * 500);
      console.log(`Waiting ${waitMs}ms before retry #${attempt+1}`);
      await new Promise(r => setTimeout(r, waitMs));

      return callLLMWithRetry(system, user, attempt + 1, maxAttempts);
    }

    console.error(`Max retry attempts (${maxAttempts}) reached.`);
    throw err;
  }
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
