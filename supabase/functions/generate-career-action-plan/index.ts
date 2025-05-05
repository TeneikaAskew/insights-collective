
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { corsHeaders } from '../_shared/utils.ts'
import { callGroqWithRetry } from '../_shared/utils.ts'

// Handle CORS preflight requests
const handleCors = (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
}

// Function to get user's resume data and career pathway results
async function getUserCareerData(supabase: any, userId: string) {
  // Get resume data
  const { data: resumeData, error: resumeError } = await supabase
    .from('resumes')
    .select('sentences, analysis')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (resumeError) {
    console.error('Error fetching resume data:', resumeError)
  }

  // Get career pathway results
  const { data: pathwayData, error: pathwayError } = await supabase
    .from('career_pathway_results')
    .select('report')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pathwayError) {
    console.error('Error fetching career pathway data:', pathwayError)
  }

  return {
    resume: resumeData,
    pathway: pathwayData
  }
}

// Extract valid JSON payload from a potentially incomplete response
// with multiple fallback strategies
function extractJsonPayload(rawResponse: string): any {
  console.log(`Raw Response: ${rawResponse}`);
  
  // Try direct JSON parsing first
  try {
    return JSON.parse(rawResponse);
  } catch (e) {
    console.log("Direct parsing failed, trying alternatives");
    
    // Try to clean up the JSON and fix common issues
    try {
      // Check if we have an incomplete JSON where the last property gets cut off
      const fixedJson = attemptJsonRepair(rawResponse);
      return JSON.parse(fixedJson);
    } catch (e2) {
      console.log(`Fixed JSON parsing failed: ${e2}`);
    }
    
    // Try to interpret the response as a JavaScript object
    try {
      // Remove potential markdown code block markers
      const cleanContent = rawResponse
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
        
      // Safely evaluate as a JavaScript object
      const evalResult = (0, eval)(`(${cleanContent})`);
      if (typeof evalResult === 'object') {
        return evalResult;
      }
    } catch (e3) {
      console.log(`JavaScript object conversion failed: ${e3}`);
    }
    
    // Try to extract individual timeframes if complete JSON parsing fails
    const timeframes = ["6_weeks", "9_weeks", "12_weeks", "6_months", "12_months"];
    const partialResult = {};
    
    for (const timeframe of timeframes) {
      try {
        const regex = new RegExp(`"${timeframe}"\\s*:\\s*(\\{[\\s\\S]*?\\})(?:\\s*,\\s*"|\\s*\\})`, 'm');
        const match = rawResponse.match(regex);
        
        if (match && match[1]) {
          try {
            partialResult[timeframe] = JSON.parse(match[1]);
            console.log(`Successfully extracted ${timeframe} section`);
          } catch (err) {
            console.log(`Failed to parse ${timeframe} section: ${err}`);
          }
        }
      } catch (e4) {
        // Continue to next timeframe
      }
    }
    
    // If we extracted at least one timeframe, return what we have
    if (Object.keys(partialResult).length > 0) {
      return partialResult;
    }
    
    // If all else fails, return a default structure
    console.error("All JSON extraction methods failed for raw response:", rawResponse);
    throw new Error("Invalid JSON payload");
  }
}

// Attempt to repair common JSON truncation issues
function attemptJsonRepair(rawJson: string): string {
  // Check for unclosed objects/arrays
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < rawJson.length; i++) {
    const char = rawJson[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    
    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
    }
  }
  
  // Complete the JSON structure if it's incomplete
  let repairedJson = rawJson;
  
  // Check if the JSON is cut off in the middle of a string
  const lastChar = repairedJson[repairedJson.length - 1];
  if (inString) {
    repairedJson += '"';
  }
  
  // Handle truncated non-string content
  const truncatedString = lastChar !== '}' && lastChar !== ']' && 
                          lastChar !== '"' && lastChar !== ',' && 
                          lastChar !== 'e' && lastChar !== 'l';
                          
  if (truncatedString) {
    // Attempt to find the last complete property
    const lastCompleteProperty = repairedJson.lastIndexOf('",');
    if (lastCompleteProperty !== -1) {
      repairedJson = repairedJson.substring(0, lastCompleteProperty + 1);
    }
  }
  
  // Close any unclosed structures (braces and brackets)
  while (braceCount > 0) {
    repairedJson += '}';
    braceCount--;
  }
  
  while (bracketCount > 0) {
    repairedJson += ']';
    bracketCount--;
  }
  
  return repairedJson;
}

// Generate the career action plan using GROQ API
async function generateActionPlan(userData: any) {
  try {
    const systemPrompt = `
        You are an expert career coach generating a personalized Career Action Plan.
        Create a structured plan based on the user's resume data and career assessment results.
        Break it down into these keys: "6_weeks", "9_weeks", "12_weeks", "6_months", "12_months".
        
        Each key's value must be an object containing:
          1. skills_to_acquire - array of objects with 'name' (string) and 'courses' (array of strings)
          2. projects_to_build - array of objects with 'title' and 'description'
          3. content_to_post - array of objects with 'platform' and 'topics' (array of strings)
          4. milestones_to_achieve - array of strings
          5. motivational_narrative - string
        
        **CRUCIAL**: Your _only_ output must be valid JSON. Do not include any explanatory text or markdown.
        Ensure the JSON is properly closed and complete.
        `;

    // Prepare user data for the prompt - safely extract and format data
    const resumeData = userData.resume || {};
    const pathwayData = userData.pathway?.report || {};
    
    let userPrompt = `Here is the user's data:\n\nRESUME DATA:\n`;
    
    // Safely handle resume data
    if (resumeData.sentences) {
      userPrompt += `Resume sentences: ${JSON.stringify(resumeData.sentences)}\n`;
    }
    
    if (resumeData.analysis) {
      // Check if analysis is a string, array, or object and handle accordingly
      if (typeof resumeData.analysis === 'string') {
        userPrompt += `Analysis: ${resumeData.analysis}\n`;
      } else {
        userPrompt += `Analysis: ${JSON.stringify(resumeData.analysis)}\n`;
      }
    } else {
      userPrompt += `No resume analysis available.\n`;
    }
    
    userPrompt += `\nCAREER PATHWAY RESULTS:\n${JSON.stringify(pathwayData)}\n\n`;
    userPrompt += `Based on this information, generate a detailed Career Action Plan broken into timeframes.`;

    const response = await callGroqWithRetry(systemPrompt, userPrompt);
    
    // Create a fallback plan structure in case of parsing failure
    const fallbackPlan = {
      "6_weeks": {
        skills_to_acquire: [{ name: "Data Analysis", courses: ["SQL Basics", "Excel for Data Analysis"] }],
        projects_to_build: [{ title: "Portfolio Website", description: "Create a personal website to showcase your skills" }],
        content_to_post: [{ platform: "LinkedIn", topics: ["career development"] }],
        milestones_to_achieve: ["Update resume with new skills"],
        motivational_narrative: "Take small steps toward your career goals each week."
      },
      "12_weeks": {
        skills_to_acquire: [{ name: "Communication", courses: ["Presentation Skills"] }],
        projects_to_build: [{ title: "Data Analysis Project", description: "Analyze a public dataset" }],
        content_to_post: [{ platform: "Twitter", topics: ["data insights"] }],
        milestones_to_achieve: ["Apply to 3 jobs in your target field"],
        motivational_narrative: "Keep building momentum and expanding your network."
      }
    };
    
    let jsonResponse;
    try {
      // Parse the response with our improved extraction function
      jsonResponse = extractJsonPayload(response);
      console.log("Response parsed successfully");
    } catch (e) {
      console.error("Failed to parse response, using fallback plan:", e);
      jsonResponse = fallbackPlan;
    }

    // Normalize the data to ensure consistent structure
    const normalizedResponse = normalizeActionPlan(jsonResponse);
    
    return normalizedResponse;
  } catch (error) {
    console.error('Error generating action plan:', error);
    throw error;
  }
}

// Normalizes the action plan to ensure consistent structure
function normalizeActionPlan(plan) {
  const timeframes = ["6_weeks", "9_weeks", "12_weeks", "6_months", "12_months"];
  const normalized = {};
  
  timeframes.forEach(timeframe => {
    if (!plan[timeframe]) {
      normalized[timeframe] = {
        skills: [],
        projects: [],
        content: [],
        milestones: [],
        narrative: ""
      };
      return;
    }
    
    const tf = plan[timeframe];
    
    normalized[timeframe] = {
      // Handle skills structure and ensure safety
      skills: Array.isArray(tf.skills_to_acquire) ? tf.skills_to_acquire.map(item => {
        if (!item || typeof item !== 'object') {
          return { name: "Skill not specified", courses: [] };
        }
        return {
          name: item.name || item.skill || "Unnamed Skill",
          courses: Array.isArray(item.courses) ? item.courses.map(course => 
            typeof course === 'string' ? { title: course, provider: '' } : 
            (typeof course === 'object' ? course : { title: String(course), provider: '' })
          ) : []
        };
      }) : [],
      
      // Ensure projects has the right structure
      projects: Array.isArray(tf.projects_to_build) ? tf.projects_to_build.map(project => {
        if (!project || typeof project !== 'object') {
          return { title: "Project not specified", description: "" };
        }
        return {
          title: project.title || "Unnamed Project",
          description: project.description || ""
        };
      }) : [],
      
      // Ensure content has the right structure
      content: Array.isArray(tf.content_to_post) ? tf.content_to_post.map(content => {
        if (!content || typeof content !== 'object') {
          return { platform: "Platform not specified", topics: [] };
        }
        return {
          platform: content.platform || "Unspecified Platform",
          topics: Array.isArray(content.topics) ? content.topics.map(topic => String(topic)) : []
        };
      }) : [],
      
      // Ensure milestones is an array of strings
      milestones: Array.isArray(tf.milestones_to_achieve) ? 
        tf.milestones_to_achieve.map(milestone => String(milestone)) : [],
      
      // Ensure narrative is a string
      narrative: tf.motivational_narrative || ""
    };
  });
  
  return normalized;
}

// Main handler for the edge function
Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from request
    let userId;
    try {
      const { userId: requestUserId } = await req.json();
      userId = requestUserId;
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error('Invalid request body format');
    }
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get user's career data
    const userData = await getUserCareerData(supabase, userId);
    
    // Generate action plan
    let actionPlan;
    try {
      actionPlan = await generateActionPlan(userData);
    } catch (error) {
      console.error('Error in generateActionPlan:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          message: 'Failed to generate action plan, please try again'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store the action plan in Supabase
    try {
      // First try to find the latest entry to update
      const { data: latestResult } = await supabase
        .from('career_pathway_results')
        .select('id, session_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Use existing session_id or create a new one
      const sessionId = latestResult?.session_id || Date.now().toString();
      console.log(`Using existing session_id: ${sessionId}`);
      
      // Update the latest entry if it exists
      if (latestResult) {
        await supabase
          .from('career_pathway_results')
          .update({ 
            action_plan: actionPlan, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', latestResult.id);
      } else {
        // Create a new entry if none exists
        await supabase
          .from('career_pathway_results')
          .insert({
            user_id: userId,
            session_id: sessionId,
            action_plan: actionPlan,
            report: userData.pathway?.report || {}
          });
      }
      
      console.log(`Saved action plan with session_id: ${sessionId}`);
    } catch (dbError) {
      console.error('Error saving action plan to database:', dbError);
      // Continue anyway to return the plan to the user
    }

    return new Response(
      JSON.stringify({ success: true, data: actionPlan }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-career-action-plan function:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
