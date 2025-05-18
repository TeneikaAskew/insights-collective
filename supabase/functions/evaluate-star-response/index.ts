import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface STARResponse {
  situation: string;
  task: string;
  action: string;
  result: string;
}

interface AIFeedback {
  clarity: number;
  completeness: number;
  relevance: number;
  suggestions: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { situation, task, action, result } = await req.json() as STARResponse;

    // Prepare the messages for Together.ai
    const messages = [
      {
        role: 'system',
        content: 'You are an expert interviewer and career coach. Your task is to evaluate STAR interview responses and provide constructive feedback.',
      },
      {
        role: 'user',
        content: `Please evaluate this STAR (Situation, Task, Action, Result) interview response and provide structured feedback:

Situation:
${situation}

Task:
${task}

Action:
${action}

Result:
${result}

Please analyze this response and provide:
1. Clarity score (1-10)
2. Completeness score (1-10)
3. Relevance score (1-10)
4. List of specific suggestions for improvement

Format your response in JSON with the following structure:
{
  "clarity": number,
  "completeness": number,
  "relevance": number,
  "suggestions": string[]
}`
      }
    ];

    // Call Together.ai API
    const response = await fetch('https://api.together.xyz/inference', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('TOGETHER_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Together.ai API error: ${response.statusText}`);
    }

    const data = await response.json();
    const feedback = JSON.parse(data.choices[0].message.content) as AIFeedback;

    return new Response(
      JSON.stringify(feedback),
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