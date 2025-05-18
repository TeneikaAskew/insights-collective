import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CodeReviewRequest {
  code: string;
  language: string;
  prompt: string;
  testCases: Array<{
    input: string;
    expected_output: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, language, prompt, testCases } = await req.json() as CodeReviewRequest;

    // Prepare the prompt for Together.ai
    const reviewPrompt = `As an expert code reviewer, please analyze this ${language} code solution:

Problem:
${prompt}

Code:
${code}

Test Cases:
${testCases.map((tc, i) => `
Test Case ${i + 1}:
Input: ${tc.input}
Expected Output: ${tc.expected_output}
`).join('\n')}

Please provide a detailed code review including:
1. Code Quality Analysis (efficiency, readability, maintainability)
2. Time and Space Complexity
3. Edge Cases Consideration
4. Best Practices Adherence
5. Specific Improvement Suggestions

Format your response in JSON with the following structure:
{
  "quality_score": number (1-10),
  "time_complexity": string,
  "space_complexity": string,
  "strengths": string[],
  "weaknesses": string[],
  "improvement_suggestions": string[],
  "edge_cases_missed": string[]
}`;

    // Call Together.ai API
    const response = await fetch('https://api.together.xyz/inference', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('TOGETHER_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [
          {
            role: 'system',
            content: 'You are an expert code reviewer with deep knowledge of algorithms, data structures, and software engineering best practices.',
          },
          {
            role: 'user',
            content: reviewPrompt,
          },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Together.ai API error: ${response.statusText}`);
    }

    const data = await response.json();
    const review = JSON.parse(data.choices[0].message.content);

    return new Response(
      JSON.stringify(review),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}); 