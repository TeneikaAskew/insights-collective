
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

const supabase = getSupabaseClient();

// API key handling for different models
const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const { jobDescriptionId, modelProvider = 'together' } = await req.json();
    
    if (!jobDescriptionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Job description ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch the job description
    const { data: jobDescription, error: fetchError } = await supabase
      .from('job_descriptions')
      .select('*')
      .eq('id', jobDescriptionId)
      .single();
    
    if (fetchError || !jobDescription) {
      return new Response(
        JSON.stringify({ success: false, error: fetchError?.message || 'Job description not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Prepare the prompt for analysis
    const systemPrompt = `You are an expert job description analyzer for a job interview preparation system. Your task is to extract and structure the following information from the provided job description:

1. Job Title/Role
2. Key Responsibilities (list format)
3. Required Qualifications (list format)
4. Preferred/Nice-to-Have Qualifications (list format)
5. Technical Keywords (list of technical skills, tools, frameworks, etc.)

Format your response as JSON with the following structure:
{
  "title": "Job Title",
  "responsibilities": ["responsibility 1", "responsibility 2", ...],
  "required_qualifications": ["qualification 1", "qualification 2", ...],
  "preferred_qualifications": ["qualification 1", "qualification 2", ...],
  "technical_keywords": ["keyword1", "keyword2", ...]
}`;

    const userPrompt = jobDescription.raw_text;
    
    let analysisResult;
    
    // Use the specified model provider
    if (modelProvider === 'openai' && openaiApiKey) {
      // OpenAI API call
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      analysisResult = JSON.parse(data.choices[0].message.content);
      
    } else if (togetherApiKey) {
      // Together.ai API call
      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${togetherApiKey}`
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.1-70B-Instruct',
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 2000
        })
      });
      
      if (!response.ok) {
        throw new Error(`Together API error: ${response.status}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Try to extract JSON from the response
      try {
        analysisResult = JSON.parse(content);
      } catch (e) {
        // Look for JSON pattern in the text
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          analysisResult = JSON.parse(match[0]);
        } else {
          throw new Error('Failed to parse analysis result');
        }
      }
    } else {
      throw new Error('No API key available for the selected model provider');
    }
    
    // Update the job description with the parsed fields
    const { error: updateError } = await supabase
      .from('job_descriptions')
      .update({ parsed_fields: analysisResult })
      .eq('id', jobDescriptionId);
    
    if (updateError) {
      throw new Error(`Failed to update job description: ${updateError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data: analysisResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in analyze-job-description function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
