// ABOUTME: Edge function that generates portfolio project ideas based on user's resume and career data
// ABOUTME: Uses AI (Gemini) to analyze user background and suggest targeted portfolio projects

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Portfolio ideas function called");

    // Authenticate the user from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No Authorization header provided');
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase credentials in environment variables');
      throw new Error('Missing Supabase credentials');
    }

    // Create client with user's auth token to respect RLS
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user's identity
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError?.message);
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = user.id; // Use verified user ID, not client-supplied
    console.log("Authenticated user:", userId);

    const requestBody = await req.json();
    const { resumeText, actionPlan, questionnaireAnswers } = requestBody;

    if (!lovableApiKey) {
      console.error("No LOVABLE_API_KEY configured");
      throw new Error('LOVABLE_API_KEY not configured');
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

    const model = 'google/gemini-2.5-flash';
    console.log(`Using model: ${model}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lovableApiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userProfileText }
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
      console.error('AI API error:', errorText);
      throw new Error(`AI API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("API response received");
    const aiResponse = data.choices?.[0]?.message?.content || '';

    // Extract JSON from the AI response
    let portfolioData = {};
    try {
      portfolioData = JSON.parse(aiResponse);
      console.log("Successfully parsed JSON response");
    } catch (e) {
      console.log("Direct JSON parsing failed, trying to extract JSON from text");
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

    // Store the recommendations using authenticated client (respects RLS).
    // BEHAVIOR CHANGE (silent-failure audit): DB persistence errors were logged
    // and then the response claimed unqualified success — users believed their
    // recommendations were saved when they were not. The generated data is
    // still returned, but the response now carries an honest `saved` flag and
    // the save error.
    let saved = false;
    let saveError: string | null = null;
    try {
      const now = new Date().toISOString();
      const { data: existingData, error: fetchError } = await supabaseClient
        .from('portfolio')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching portfolio data:', fetchError);
      }

      if (existingData) {
        const { error: updateError } = await supabaseClient
          .from('portfolio')
          .update({ recommendations: portfolioData, updated_at: now })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating portfolio data:', updateError);
          saveError = updateError.message;
        } else {
          console.log('Updated portfolio recommendations in database');
          saved = true;
        }
      } else {
        const { error: insertError } = await supabaseClient
          .from('portfolio')
          .insert({
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
          saveError = insertError.message;
        } else {
          console.log('Saved portfolio recommendations to database');
          saved = true;
        }
      }
    } catch (dbError) {
      console.error('Error storing portfolio data in database:', dbError);
      saveError = dbError?.message || String(dbError);
    }

    // For backward compatibility, also save to resumes table
    try {
      const { error: resumeError } = await supabaseClient
        .from('resumes')
        .insert({
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

    console.log("Returning successful response");
    return new Response(JSON.stringify({
      success: true,
      data: portfolioData,
      saved,
      ...(saveError ? { saveError } : {})
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in portfolio-ideas function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
