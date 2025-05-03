
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
    const systemPrompt = `You are an expert career coach generating a personalized Career Action Plan. 
Create a structured plan based on the user's resume data and career assessment results.
The plan should be broken down into timeframes: 6 weeks, 9 weeks, 12 weeks, 6 months, and 12 months.

Each timeframe should include:
1. Skills to acquire (with specific online courses/trainings from platforms like Coursera, Udemy, LinkedIn Learning)
2. Projects to build (practical portfolio projects aligned with their career direction)
3. Content to post on LinkedIn/Twitter to build their professional brand
4. Milestones to achieve (concrete steps like updating resume, applying to roles, joining communities)
5. A motivational narrative about their trajectory for this timeframe

Be supportive, actionable, and focused. The plan should feel like a natural extension of their existing career insights.
Return a JSON object with these timeframes as keys: "6_weeks", "9_weeks", "12_weeks", "6_months", "12_months".

Ensure your response is well-structured JSON that can be directly used in a frontend application.`;

    const userPrompt = `Here is the user's data:

RESUME DATA:
${JSON.stringify(userData.resume || {})}

CAREER PATHWAY RESULTS:
${JSON.stringify(userData.pathway?.report || {})}

Based on this information, generate a detailed Career Action Plan broken into timeframes.`;

    const response = await callGroqWithRetry(systemPrompt, userPrompt);
    
    // Parse the response - it should be JSON already but might be wrapped in markdown code blocks
    let jsonResponse;
    try {
      // First try direct parsing
      jsonResponse = JSON.parse(response);
      console.log("Response: ",jsonResponse)
    } catch (e) {
      // If that fails, try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonResponse = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error("Failed to parse GROQ response as JSON");
      }
    }

    return jsonResponse;
  } catch (error) {
    console.error('Error generating action plan:', error);
    throw error;
  }
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

    // Store the action plan in Supabase (optional - can be enabled if needed)
    // await supabase.from('career_action_plans').upsert({
    //   user_id: userId,
    //   plan: actionPlan,
    //   created_at: new Date().toISOString()
    // });

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
