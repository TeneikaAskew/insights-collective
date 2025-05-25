// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import "https://deno.land/x/xhr@0.1.0/mod.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { encoding_for_model } from 'npm:@dqbd/tiktoken';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

async function countTokens(text, model = 'gpt-4o-mini') {
  const enc = await encoding_for_model(model);
  const tokenCount = enc.encode(text).length;
  enc.free();
  return tokenCount;
}

const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Career advice function called");
    
    const body = await req.json();
    const { prompt, pathwayQuestions, pathwayAnswers, resumeText } = body;

    console.log("Prompt:", prompt);
    console.log("Pathway questions:", pathwayQuestions);
    console.log("Pathway answers:", pathwayAnswers);
    console.log("Resume text:", resumeText);

    // Validate required fields
    if (!prompt || !pathwayQuestions || !pathwayAnswers) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: prompt, pathwayQuestions, or pathwayAnswers" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!togetherApiKey) {
      console.error("Together AI API key not configured");
      return new Response(
        JSON.stringify({ error: "Together AI API key not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Build context from user answers
    let userContext = "User's Career Pathway Responses:\n\n";
    pathwayQuestions.forEach((question: any) => {
      const answer = pathwayAnswers[question.id];
      if (answer) {
        userContext += `${question.label}: ${answer}\n`;
      }
    });

    if (resumeText) {
      userContext += `\nUser's Resume:\n${resumeText}\n`;
    }

    console.log("User context:", userContext);

    // New system prompt for structured JSON output
    const systemPrompt = `You are a professional career advisor and industry expert in technology. Based on the user's responses and resume, generate a comprehensive career pathway report as a valid JSON object with the following structure:\n\n{
  \"summary\": \"string\",
  \"recommendedRoles\": [
    {
      \"title\": \"string\",
      \"description\": \"string\",
      \"salaryRange\": \"string\"
    }
  ],
  \"skillsAndCourses\": [
    {
      \"skill\": \"string\",
      \"course\": \"string\",
      \"provider\": \"string\",
      \"level\": \"string\"
    }
  ],
  \"nextStepRecommendations\": \"string\",
  \"potentialRoles\": [
    {
      \"title\": \"string\",
      \"description\": \"string\"
    }
  ],
  \"careerPathSteps\": [
    {
      \"step\": \"string\",
      \"action\": \"string\",
      \"timeline\": \"string\"
    }
  ],
  
  \"futureCareerPath\": [
    {
      \"step\": \"string\",
      \"action\": \"string\",
      \"timeline\": \"string\",
      \"focusAreas\": \"string\"
    }
  ],
  \"keyTakeaways\": [
    \"string\"
  ]
}\n\nDo not include any markdown or commentary, only return valid JSON. Fill in each section with personalized, actionable, and specific content based on the user's answers and resume.
\n\nProvide a minimum of 3 future career steps. Provide a minimum of 4 skills and courses. Provide a minimum of 3 recommended roles. Provide a minimumn of 3 recommended roles. 
\n\nProvide a minimum of 3 key takeaways. Provide a minimum of 3 career path steps.`;

    // Prepare chat messages for Together.ai
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContext }
    ];
    console.log("Messages:", messages);
    console.log("Making request to Together.ai API");

    const n = await countTokens(systemPrompt + userContext, 'gpt-4o-mini');
    console.log(`Prompt uses ${n} tokens`);

    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${togetherApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
        messages: messages,
        temperature: 0.7,
        max_tokens: 5000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Together.ai API error:', errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate career advice" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await response.json();
    console.log("Response from Together.ai API:", data);
    let report;
    try {
      report = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      // fallback or error handling
      report = { error: "Invalid JSON from LLM", raw: data.choices[0].message.content };
    }
    console.log("Generated structured career advice successfully: ", report);
    return new Response(
      JSON.stringify(report),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error(`Error in evaluateCareerAdvice function: ${error.message}`);
    return new Response(
      JSON.stringify({ error: "Server error processing request" }),
      { status: 500, headers: corsHeaders }
    );
  }
});