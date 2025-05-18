import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { responseId } = await req.json();

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid token');
    }

    // Get STAR response
    const { data: starResponse, error: responseError } = await supabase
      .from('star_responses')
      .select('*, study_guides!inner(*)')
      .eq('id', responseId)
      .single();

    if (responseError || !starResponse) {
      throw new Error('STAR response not found');
    }

    // Generate evaluation using Together.ai
    const prompt = `
    Evaluate this STAR response for a behavioral interview question:

    Question: ${starResponse.study_guides.questions.find(q => q.id === starResponse.question_id)?.question}

    Situation: ${starResponse.situation}
    Task: ${starResponse.task}
    Action: ${starResponse.action}
    Result: ${starResponse.result}

    Evaluate the response based on:
    1. Completeness of each STAR component
    2. Specificity and detail level
    3. Relevance to the question
    4. Impact demonstration
    5. Professional communication

    Format the response as a JSON object with these exact keys:
    {
      "scores": {
        "situation": number (1-10),
        "task": number (1-10),
        "action": number (1-10),
        "result": number (1-10),
        "overall": number (1-10)
      },
      "feedback": {
        "strengths": string[],
        "improvements": string[],
        "suggestions": string[]
      },
      "analysis": {
        "completeness": string,
        "specificity": string,
        "relevance": string,
        "impact": string,
        "communication": string
      }
    }
    `;

    const response = await fetch('https://api.together.xyz/inference', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-2-70b-chat',
        prompt,
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.7,
        top_k: 50,
        repetition_penalty: 1.1,
      }),
    });

    const result = await response.json();
    const feedback = JSON.parse(result.output.choices[0].text);

    // Update STAR response with feedback
    const { data: updatedResponse, error: updateError } = await supabase
      .from('star_responses')
      .update({
        ai_feedback: feedback,
      })
      .eq('id', responseId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify(updatedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
}); 