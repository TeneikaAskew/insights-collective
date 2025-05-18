
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
    const { jobDescriptionId, userId, modelProvider = 'together' } = await req.json();
    
    if (!jobDescriptionId || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Job description ID and user ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch the job description with parsed fields
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
    
    // Prepare the prompt for study guide generation
    const systemPrompt = `You are an expert interview preparation assistant. Based on the job description provided, generate a comprehensive study guide to help the user prepare for their interview. The study guide should include:

1. Key Competencies: Identify 3-5 core competencies required for this role (e.g., problem-solving, communication, technical expertise).
2. Behavioral Interview Questions: Generate 7-10 behavioral questions likely to be asked, mapped to the competencies.
3. Sample STAR-format Answers: For each question, provide a sample answer in the STAR format (Situation, Task, Action, Result).
4. Technical Checklist: Create a checklist of technical topics and skills the candidate should review before the interview.

Format your response as JSON with the following structure:
{
  "competencies": [
    {
      "id": "unique-id-1",
      "name": "Competency Name",
      "description": "Description of the competency"
    }
  ],
  "questions": [
    {
      "id": "unique-id-q1",
      "question": "Tell me about a time when...",
      "competency_id": "unique-id-1",
      "sample_answer": {
        "situation": "Brief description of the situation",
        "task": "What was required of you",
        "action": "What you did",
        "result": "The outcome of your actions"
      }
    }
  ],
  "technical_checklist": [
    {
      "id": "unique-id-t1",
      "name": "Technical skill or topic",
      "category": "Category (e.g., Programming, Database, Cloud)",
      "priority": "high|medium|low"
    }
  ]
}`;

    // Combine the job description text and parsed fields
    const jobDescriptionData = {
      raw_text: jobDescription.raw_text,
      parsed_fields: jobDescription.parsed_fields
    };
    
    const userPrompt = JSON.stringify(jobDescriptionData);
    
    let studyGuideResult;
    
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
          temperature: 0.4
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      studyGuideResult = JSON.parse(data.choices[0].message.content);
      
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
          temperature: 0.4,
          max_tokens: 4000
        })
      });
      
      if (!response.ok) {
        throw new Error(`Together API error: ${response.status}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Try to extract JSON from the response
      try {
        studyGuideResult = JSON.parse(content);
      } catch (e) {
        // Look for JSON pattern in the text
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          studyGuideResult = JSON.parse(match[0]);
        } else {
          throw new Error('Failed to parse study guide result');
        }
      }
    } else {
      throw new Error('No API key available for the selected model provider');
    }
    
    // Create the study guide record in the database
    const { data: studyGuide, error: insertError } = await supabase
      .from('study_guides')
      .insert({
        job_description_id: jobDescriptionId,
        user_id: userId,
        competencies: studyGuideResult.competencies,
        questions: studyGuideResult.questions,
        technical_checklist: studyGuideResult.technical_checklist
      })
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to create study guide: ${insertError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data: studyGuide
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in generate-study-guide function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
