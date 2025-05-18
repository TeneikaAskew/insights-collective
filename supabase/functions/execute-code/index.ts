import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const PISTON_API_URL = 'https://emkc.org/api/v2/piston/execute';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { challengeId, code, language } = await req.json();

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

    // Get challenge details
    const { data: challenge, error: challengeError } = await supabase
      .from('code_challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      throw new Error('Challenge not found');
    }

    // Prepare test cases
    const testCases = challenge.test_cases;
    const results = [];
    let allTestsPassed = true;

    // Execute code for each test case
    for (const testCase of testCases) {
      const response = await fetch(PISTON_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language,
          version: '*',
          files: [
            {
              name: 'main',
              content: `
                ${code}
                
                // Test case input
                ${testCase.setup || ''}
                ${testCase.input}
              `,
            },
          ],
        }),
      });

      const result = await response.json();
      
      // Check if output matches expected
      const outputMatches = testCase.expectedOutput === result.run.output.trim();
      if (!outputMatches) allTestsPassed = false;

      results.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: result.run.output.trim(),
        passed: outputMatches,
        executionTime: result.run.time,
      });
    }

    // Save attempt to database
    const { data: attempt, error: saveError } = await supabase
      .from('code_attempts')
      .insert({
        user_id: user.id,
        challenge_id: challengeId,
        code,
        language,
        duration: null, // TODO: Add duration tracking in frontend
        passed_tests: allTestsPassed,
        ai_review: null, // Will be added by separate review function
      })
      .select()
      .single();

    if (saveError) {
      throw saveError;
    }

    return new Response(
      JSON.stringify({
        attempt,
        results,
        allTestsPassed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
}); 