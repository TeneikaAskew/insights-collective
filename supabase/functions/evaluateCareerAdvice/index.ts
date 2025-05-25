
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import "https://deno.land/x/xhr@0.1.0/mod.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    
    const { prompt, pathwayQuestions, pathwayAnswers, resumeText } = await req.json();

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

    const systemPrompt = `You are a professional career advisor. Based on the user's responses and resume, generate a comprehensive career pathway report in markdown format. 

Structure your response exactly as follows:

**Personalized Career Advice Report**

**Summary:** 
[2-3 sentences about their career profile and strengths]

**Recommended Roles:** 
1. [Role Title] - [Description] (Salary: $X,XXX - $X,XXX)
2. [Role Title] - [Description] (Salary: $X,XXX - $X,XXX)
3. [Role Title] - [Description] (Salary: $X,XXX - $X,XXX)

**Skills and Matching Courses:**
| Skill | Course | Provider | Level |
|-------|--------|----------|-------|
| [Skill] | [Course Name] | [Provider] | [Beginner/Intermediate/Advanced] |
| [Skill] | [Course Name] | [Provider] | [Beginner/Intermediate/Advanced] |
| [Skill] | [Course Name] | [Provider] | [Beginner/Intermediate/Advanced] |

**Next-Step Career Recommendations:**
[Detailed paragraph with specific actionable advice]

**Roles that Might be Right for You:**
1. [Alternative Role 1]
2. [Alternative Role 2]
3. [Alternative Role 3]

**Path to Your Aspirational Role:**
1. **Step 1:** [Action] (Timeline: [X months])
2. **Step 2:** [Action] (Timeline: [X months])
3. **Step 3:** [Action] (Timeline: [X months])

**Key Takeaways:**
- [Important insight 1]
- [Important insight 2]
- [Important insight 3]

Be specific, actionable, and personalized based on their responses. Focus on data/tech careers when relevant.`;

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
    const generatedText = data.choices[0].message.content;

    console.log("Generated career advice successfully");
    
    return new Response(
      JSON.stringify({ generatedText }),
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