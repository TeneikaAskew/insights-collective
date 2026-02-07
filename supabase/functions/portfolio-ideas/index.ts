import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// This function sets up Supabase client with service role key credentials from env
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !supabaseKey) {
    console.error('getSupabaseClient: Missing Supabase credentials in environment variables!');
    throw new Error('Missing Supabase credentials');
  }
  return createClient(supabaseUrl, supabaseKey);
}
export const supabase = getSupabaseClient();
const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    console.log("Portfolio ideas function called");
    const requestBody = await req.json();
    console.log("Request body:", JSON.stringify(requestBody));
    const { resumeText, actionPlan, questionnaireAnswers, userId } = requestBody;
    if (!togetherApiKey) {
      console.error("No Together API key configured");
      throw new Error('Together.ai API key not configured');
    }
    console.log('User:', userId, 'RESUME:', resumeText?.length || 0, ' QUESTIONNAIRE: ', questionnaireAnswers);
    // Construct the prompt
    const systemPrompt = `You are a career portfolio advisor helping someone identify project ideas and career paths based on their background. 
    Analyze the following information and provide a detailed analysis:
    1. Key strengths & interests (extracted from their information)
    2. A skill inventory (list all skills you identify)
    3. Top 2-3 target roles that match their profile
    4. For each role, suggest 3-5 portfolio project ideas basedon role and/or hobbies with:
       - Project name and description
       - Required skills & tools
       - Estimated effort level (Low: <10 hrs, Medium: 10-30 hrs, High: >30 hrs)
       - Impact statement (why hiring managers would value this)
       - Suggested milestones/roadmap
    5. Identify skill gaps and recommend learning resources
    
    Format your response as structured JSON without explanatory text. The structure should be:
    {
      "strengths": ["strength1", "strength2", ...],
      "skills": ["skill1", "skill2", ...],
      "targetRoles": [
        {
          "title": "Role Title",
          "coreSkills": ["skill1", "skill2", ...],
          "commonDeliverables": ["deliverable1", "deliverable2", ...],
          "projectIdeas": [
            {
              "title": "Project Title",
              "description": "Project Description",
              "requiredSkills": ["skill1", "skill2", ...],
              "effortLevel": "Low/Medium/High",
              "impact": "Impact statement",
              "roadmap": ["milestone1", "milestone2", ...]
            },
            ...
          ]
        },
        ...
      ],
      "skillGaps": {
        "missingSkills": ["skill1", "skill2", ...],
        "learningResources": [
          {
            "skill": "skill name",
            "resources": ["resource1", "resource2", ...]
          },
          ...
        ]
      }
    }`;
    // Combine all user data into a user profile for the AI
    const userProfileText = `
    RESUME INFORMATION:
    ${resumeText || "No resume provided"}
    
    CAREER ACTION PLAN:
    ${actionPlan ? JSON.stringify(actionPlan) : "No action plan provided"}
    
    QUESTIONNAIRE ANSWERS:
    Interests: ${questionnaireAnswers?.interests || "Not provided"}
    Current role: ${questionnaireAnswers?.currentRole || "Not provided"}
    Hobbies/free time activities: ${questionnaireAnswers?.hobbies || "Not provided"}
    `;
    // Use Mixtral or Llama model based on availability
    const model = 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
    console.log(`Using model: ${model}`);
    // *** FIXED: Updated the API request to use the correct chat completion format ***
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${togetherApiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userProfileText
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        top_p: 0.8,
        top_k: 50,
        stream: false
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Together API error:', errorText);
      throw new Error(`Together API returned status ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    console.log("API response: ", data);
    const aiResponse = data.choices?.[0]?.message?.content || '';
    // Extract JSON from the AI response
    let portfolioData = {};
    try {
      // Try to parse directly first
      portfolioData = JSON.parse(aiResponse);
      console.log("Successfully parsed JSON response");
    } catch (e) {
      console.log("Direct JSON parsing failed, trying to extract JSON from text");
      // If direct parsing fails, try to extract JSON from text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          portfolioData = JSON.parse(jsonMatch[0]);
          console.log("Successfully extracted and parsed JSON from text");
        } catch (innerError) {
          console.error('Failed to parse JSON from AI response:', innerError);
          throw new Error('Failed to parse portfolio data from AI response');
        }
      } else {
        console.error('No valid JSON found in AI response');
        throw new Error('No valid JSON found in AI response');
      }
    }
    // Store the recommendations in the portfolio table
    if (userId) {
      try {
        const now = new Date().toISOString();
        // First, check if we have an entry for this user
        const { data: existingData, error: fetchError } = await supabase.from('portfolio').select('*').eq('user_id', userId).maybeSingle();
        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching portfolio data:', fetchError);
        }
        if (existingData) {
          // Update existing record
          const { data: updatedData, error: updateError } = await supabase.from('portfolio').update({
            recommendations: portfolioData,
            updated_at: now
          }).eq('user_id', userId);
          if (updateError) {
            console.error('Error updating portfolio data:', updateError);
          } else {
            console.log('Updated portfolio recommendations in database');
          }
        } else {
          // Insert new record with questionnaire data if available
          const { data: insertedData, error: insertError } = await supabase.from('portfolio').insert({
            user_id: userId,
            recommendations: portfolioData,
            current_role: questionnaireAnswers?.currentRole,
            interests: questionnaireAnswers?.interests,
            hobbies: questionnaireAnswers?.hobbies,
            created_at: now,
            updated_at: now
          });
          if (insertError) {
            console.error('Error inserting portfolio data:', insertError);
          } else {
            console.log('Saved portfolio recommendations to database');
          }
        }
      } catch (dbError) {
        console.error('Error storing portfolio data in database:', dbError);
      }
      // For backward compatibility, also save to resumes table
      try {
        const { error: resumeError } = await supabase.from('resumes').insert({
          user_id: userId,
          recommendation: portfolioData,
          created_at: new Date().toISOString()
        });
        if (resumeError) {
          console.error('Error saving to resumes table:', resumeError);
        } else {
          console.log('Also saved portfolio ideas to resumes table for compatibility');
        }
      } catch (error) {
        console.error('Error in legacy resumes table storage:', error);
      }
    }
    console.log("Returning successful response");
    return new Response(JSON.stringify({
      success: true,
      data: portfolioData
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in portfolio-ideas function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
