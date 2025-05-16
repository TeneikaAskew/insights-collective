
// Follow Deno Deploy's best practices
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle CORS preflight requests
async function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
}

// Create a Supabase client with the service role key
function createSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  // Get the authorization header from the request
  const authHeader = req.headers.get('Authorization');
  
  return createClient(
    supabaseUrl,
    authHeader ? authHeader.replace('Bearer ', '') : supabaseKey,
    {
      global: {
        headers: {
          Authorization: authHeader || `Bearer ${supabaseKey}`,
        },
      },
      auth: {
        persistSession: false,
      },
    }
  );
}

// Generate response using Together API
async function generateWithTogetherAI(prompt: string) {
  const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
  if (!TOGETHER_API_KEY) {
    throw new Error('TOGETHER_API_KEY is not set');
  }

  try {
    const response = await fetch('https://api.together.xyz/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOGETHER_API_KEY}`
      },
      body: JSON.stringify({
        model: 'togethercomputer/llama-2-70b-chat',
        prompt: prompt,
        max_tokens: 2048,
        temperature: 0.7,
        top_p: 0.7,
        top_k: 50,
        stop: ['<|im_end|>']
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error('Together API error:', data.error);
      throw new Error(data.error.message || 'Error calling Together API');
    }

    return data.choices[0].text;
  } catch (error) {
    console.error('Error calling Together API:', error);
    throw error;
  }
}

// Process portfolio explorer data
async function handlePortfolioExplorer(payload: any) {
  const { resumeText, actionPlan, questionnaireAnswers } = payload;
  
  // Create a detailed prompt for the Together AI API
  const prompt = `
<|im_start|>system
You are an expert career advisor specialized in helping users create portfolio projects that will advance their career. You will analyze the user's background, interests, and goals to recommend specific career paths and practical portfolio projects.

Analyze the following information about the user:
1. Resume text (if available)
2. Career action plan (if available)
3. Their current role
4. Their professional interests
5. Their hobbies and free-time activities

Based on this analysis, you will provide:
1. The user's key strengths and skills
2. 2-3 target roles they should consider
3. For each role:
   - Core skills needed
   - Common tools used
   - Typical deliverables
   - Example portfolio pieces
4. Specific project ideas for each role, including:
   - Title
   - Description
   - Required skills
   - Effort level (easy/medium/hard or time estimate)
   - Impact for job applications

Format your response as valid JSON that can be parsed by a computer. Use the following structure:

```json
{
  "userSkills": ["skill1", "skill2", ...],
  "targetRoles": [
    {
      "title": "Role Title",
      "coreSkills": ["skill1", "skill2", ...],
      "tools": ["tool1", "tool2", ...],
      "deliverables": ["deliverable1", "deliverable2", ...],
      "portfolioExamples": [
        {
          "title": "Example Title",
          "type": "GitHub / Case Study / Dashboard / etc",
          "description": "Brief description of the example",
          "link": "optional link to example"
        }
      ]
    }
  ],
  "projectIdeas": [
    {
      "id": "unique-id-1",
      "roleTitle": "Role Title",
      "title": "Project Title",
      "description": "Project Description",
      "requiredSkills": ["skill1", "skill2", ...],
      "effortLevel": "2-4 hours / 1 week / etc",
      "impact": "Shows mastery of X / Demonstrates Y"
    }
  ]
}
```

Make the response useful, practical, and actionable. Focus on realistic projects that showcase skills relevant to the target roles.
<|im_end|>

<|im_start|>user
I need help creating portfolio project ideas for my career transition.

Here's my information:
${resumeText ? `\nRESUME TEXT:\n${resumeText}` : '\nNo resume text provided.'}

${actionPlan ? `\nACTION PLAN:\n${JSON.stringify(actionPlan, null, 2)}` : '\nNo action plan provided.'}

CURRENT ROLE: ${questionnaireAnswers.currentRole || 'Not specified'}

PROFESSIONAL INTERESTS: ${questionnaireAnswers.interests ? questionnaireAnswers.interests.join(', ') : 'Not specified'}

HOBBIES/FREE-TIME ACTIVITIES: ${questionnaireAnswers.hobbies || 'Not specified'}

Based on this information, please analyze my profile and suggest target roles and portfolio project ideas that would help me in my career growth.
<|im_end|>

<|im_start|>assistant
`;

  try {
    // Call Together AI API
    const aiResponse = await generateWithTogetherAI(prompt);
    
    // Extract the JSON from the response
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                     aiResponse.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from AI response');
    }
    
    let jsonString = jsonMatch[1] || jsonMatch[0];
    
    // Parse the JSON
    const data = JSON.parse(jsonString);
    
    // Return the parsed result
    return data;
  } catch (error) {
    console.error('Error in handlePortfolioExplorer:', error);
    throw error;
  }
}

// Handle request
serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = await handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Parse the request body
    const payload = await req.json();
    const { type } = payload;
    let result;

    // Handle different request types
    if (type === 'portfolio-explorer') {
      result = await handlePortfolioExplorer(payload);
    } else {
      throw new Error(`Unsupported request type: ${type}`);
    }

    // Return success response
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error processing request:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred processing your request',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
