
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

// Generate the career action plan using GROQ API
async function generateActionPlan(userData: any) {
  try {
    const systemPrompt = `
        You are an expert career coach generating a personalized Career Action Plan.
        Create a structured plan based on the user's resume data and career assessment results.
        Break it down into these keys: "6_weeks", "9_weeks", "12_weeks", "6_months", "12_months".
        
        Each key's value must be an object containing:
          1. skills_to_acquire - array of objects with 'skill' (string) and 'courses' (array of strings)
          2. projects_to_build - array of objects with 'title' and 'description'
          3. content_to_post - array of objects with 'platform' and 'topics' (array of strings)
          4. milestones_to_achieve - array of strings
          5. motivational_narrative - string
        
        **CRUCIAL**: Your _only_ output must be valid JSON. Do not include any explanatory text or markdown.
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
    
    // Parse the response - it should be JSON already but might be wrapped in markdown code blocks
    let jsonResponse;
    try {
      // First try direct parsing
      jsonResponse = JSON.parse(response);
      console.log("Response: ",jsonResponse)
    } catch (e) {
      // If that fails, try to extract JSON from markdown code blocks
      console.log("Direct parsing failed, trying alternatives");
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonResponse = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("Failed to parse GROQ response as JSON");
      }
    }

    // Normalize the data to ensure consistent structure
    const normalizedResponse = normalizeActionPlan(jsonResponse);
    console.log("Raw action plan:", JSON.stringify(jsonResponse, null, 2));
    console.log("Normalized action plan:", JSON.stringify(normalizedResponse, null, 2));
    
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
      // Convert skills structure to be directly usable in the frontend
      skills: Array.isArray(tf.skills_to_acquire) ? tf.skills_to_acquire.map(item => ({
        name: item.skill,
        courses: Array.isArray(item.courses) ? item.courses.map(course => 
          typeof course === 'string' ? { title: course, provider: '' } : course
        ) : []
      })) : [],
      
      // Ensure projects has the right structure
      projects: Array.isArray(tf.projects_to_build) ? tf.projects_to_build : [],
      
      // Ensure content has the right structure
      content: Array.isArray(tf.content_to_post) ? tf.content_to_post : [],
      
      // Ensure milestones is an array of strings
      milestones: Array.isArray(tf.milestones_to_achieve) ? tf.milestones_to_achieve : [],
      
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
    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get user's career data
    const userData = await getUserCareerData(supabase, userId);
    
    // Generate action plan
    const actionPlan = await generateActionPlan(userData);

    // Store the action plan in Supabase
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
    }
    
    console.log(`Saved action plan with existing session_id: ${sessionId}`);

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
