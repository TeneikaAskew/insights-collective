
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

// Website content knowledge base - this would ideally be extracted from the website or stored in the database
const websiteKnowledge = {
  "AI/ML": `Machine Learning Engineers design, build, and deploy machine learning models to solve complex problems. They typically need skills in Python, TensorFlow/PyTorch, and statistics. The career path includes Junior ML Engineer, ML Engineer, Senior ML Engineer, and ML Architect roles. Average salaries range from $90,000 to $170,000 depending on experience.`,
  
  "Analytics": `Data Analysts collect, process, and analyze data to help organizations make better decisions. They typically use SQL, Excel, and visualization tools like Tableau or Power BI. Career progression includes Junior Analyst, Data Analyst, Senior Analyst, and Analytics Manager. Salaries typically range from $65,000 to $120,000.`,
  
  "Data Engineering": `Data Engineers build and maintain data pipelines and infrastructure to ensure data is accessible for analysis. They work with tools like SQL, Python, Spark, and cloud platforms. Career progression includes Junior Data Engineer, Data Engineer, Senior Data Engineer, and Data Architect. Salaries range from $85,000 to $160,000.`,
  
  "Business Intelligence": `BI professionals focus on transforming data into actionable insights for business stakeholders. They use SQL, BI tools, and develop dashboards and reports. The career path includes BI Analyst, BI Developer, Senior BI Developer, and BI Manager roles. Salaries typically range from $70,000 to $130,000.`
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, careerFocus, careerPath, salaryCap, assistantType } = await req.json();
    
    if (!query) {
      throw new Error('Query is required');
    }

    // Initialize OpenAI client
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is missing');
    }

    // Gather context from the website knowledge
    const pathKnowledge = websiteKnowledge[careerPath as keyof typeof websiteKnowledge] || '';
    
    // Create a prompt that includes website knowledge and user context
    const systemPrompt = `You are a helpful career assistant specializing in ${assistantType}. 
      Your knowledge includes the following information about the ${careerPath} career path:
      ${pathKnowledge}
      
      The user is focused on the ${careerFocus} industry with a target salary of up to $${salaryCap}.
      When answering questions, prioritize information from your knowledge base first, then supplement with your general knowledge.
      Keep responses helpful, informative, and relevant to career guidance.`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get response from OpenAI');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Return the response to the client
    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
