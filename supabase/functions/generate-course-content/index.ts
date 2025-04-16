
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
    const { prompt, field } = await req.json();
    const openAIKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('GROQ');
    
    if (!openAIKey) {
      return new Response(
        JSON.stringify({ 
          error: 'API key not configured. Please add OPENAI_API_KEY to your Supabase project secrets.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    let systemPrompt = 'You are an expert educational course content creator.';
    
    // Customize system prompt based on the field
    if (field === 'title') {
      systemPrompt += ' Create a concise, engaging course title.';
    } else if (field === 'description') {
      systemPrompt += ' Write a comprehensive course description that outlines learning objectives, target audience, and key topics.';
    } else if (field === 'module_content') {
      systemPrompt += ' Generate detailed educational module content with proper structure, explanations, examples, and concepts that would be valuable for students.';
    }
    
    // Choose which API to use based on available keys
    const apiEndpoint = openAIKey.startsWith('sk-') 
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions';
    
    const model = openAIKey.startsWith('sk-') 
      ? 'gpt-4o-mini'  // Use OpenAI model
      : 'llama3-8b-8192';  // Use Groq model
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: field === 'title' ? 50 : field === 'description' ? 300 : 2000,
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Error generating content');
    }
    
    const generatedContent = data.choices[0].message.content;
    
    return new Response(
      JSON.stringify({ content: generatedContent }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in generate-course-content function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate content' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
