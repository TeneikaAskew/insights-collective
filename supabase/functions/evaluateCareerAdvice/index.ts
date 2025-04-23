// Edge function to evaluate career advice using OpenAI based on prompt, pathway questions, pathway answers, and optional resume text.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const GROQ_API_KEY  = Deno.env.get('GROQ');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("Request received")
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Support both the old and new parameter names for backward compatibility
    const prompt = body.prompt;
    const PathwayQuestions = body.PathwayQuestions || body.Quizquestions;
    const pathwayAnswers = body.pathwayAnswers || body.quizAnswers;
    const resumeText = body.resumeText;

    if (!prompt || !PathwayQuestions || !pathwayAnswers) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build optimized prompt - only include essential data
    let combinedPrompt = `${prompt}\n\nUser's pathway answers:\n`;

    // Only include questions with actual answers to save space
    for (const question of PathwayQuestions) {
      const answer = pathwayAnswers[question.id] || '';
      if (answer.trim()) {
        // Include only the answer label and response, skip placeholders
        combinedPrompt += `${question.label || question.id}: ${answer}\n`;
      }
    }

    // Limit resume text if provided
    if (resumeText) {
      // Truncate resume text if too long (keeping first 1000 chars)
      const truncatedResume = resumeText.length > 1000 
        ? resumeText.substring(0, 1000) + "... [truncated]" 
        : resumeText;
      combinedPrompt += `\nUser Resume Summary:\n${truncatedResume}\n`;
    }

    // Compose the message array for gpt chat completion
    const messages = [
      { role: "system", content: "You are a helpful career coach assistant that synthesizes data to give clear career advice." },
      { role: "user", content: combinedPrompt },
    ];

    // Call API with reduced tokens and more efficient settings
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'compound-beta-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1000, // Reduced from 1200
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('API error:', errorDetails);
      return new Response(JSON.stringify({ error: 'API error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in evaluateCareerAdvice function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
