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
    const { attemptId } = await req.json();

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

    // Get code attempt with challenge details
    const { data: attempt, error: attemptError } = await supabase
      .from('code_attempts')
      .select('*, code_challenges(*)')
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      throw new Error('Code attempt not found');
    }

    // Generate code review using Together.ai
    const prompt = `
    Review this code submission for a coding challenge:

    Challenge: ${attempt.code_challenges.prompt}

    Code (${attempt.language}):
    ${attempt.code}

    Test Results: ${attempt.passed_tests ? 'All tests passed' : 'Some tests failed'}

    Provide a thorough code review focusing on:
    1. Code correctness and functionality
    2. Time and space complexity
    3. Code style and best practices
    4. Potential improvements
    5. Alternative approaches

    Format the response as a JSON object with these exact keys:
    {
      "analysis": {
        "correctness": string,
        "complexity": {
          "time": string,
          "space": string
        },
        "style": string,
        "maintainability": string
      },
      "scores": {
        "correctness": number (1-10),
        "efficiency": number (1-10),
        "style": number (1-10),
        "overall": number (1-10)
      },
      "feedback": {
        "strengths": string[],
        "improvements": string[],
        "alternative_approaches": string[]
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
    const review = JSON.parse(result.output.choices[0].text);

    // Update code attempt with review
    const { data: updatedAttempt, error: updateError } = await supabase
      .from('code_attempts')
      .update({
        ai_review: review,
      })
      .eq('id', attemptId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify(updatedAttempt),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
}); 