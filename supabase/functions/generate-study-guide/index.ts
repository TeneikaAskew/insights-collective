import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const TOGETHER_API_KEY = Deno.env.get('TOGETHER_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobDescriptionId } = await req.json();

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

    // Get job description
    const { data: jobDescription, error: jobError } = await supabase
      .from('job_descriptions')
      .select('*')
      .eq('id', jobDescriptionId)
      .single();

    if (jobError || !jobDescription) {
      throw new Error('Job description not found');
    }

    // Generate study guide using Together.ai
    const prompt = `
    Analyze this job description and create a comprehensive study guide:

    ${jobDescription.raw_text}

    Create a study guide with:
    1. Key competencies required (technical and soft skills)
    2. Behavioral interview questions specific to the role
    3. Technical topics to review
    4. Sample STAR stories that would be relevant
    5. Key projects or experiences to highlight

    Format the response as a JSON object with these exact keys:
    {
      "competencies": {
        "technical": [{"skill": string, "importance": "high"|"medium"|"low"}],
        "soft": [{"skill": string, "importance": "high"|"medium"|"low"}]
      },
      "questions": [
        {
          "type": "behavioral"|"technical",
          "question": string,
          "targetCompetency": string,
          "preparationTips": string
        }
      ],
      "technical_checklist": [
        {
          "topic": string,
          "subtopics": string[],
          "resources": string[],
          "priority": "high"|"medium"|"low"
        }
      ]
    }
    `;

    const response = await fetch('https://api.together.xyz/inference', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-2-70b-chat',
        prompt,
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.7,
        top_k: 50,
        repetition_penalty: 1.1,
      }),
    });

    const result = await response.json();
    const studyGuideContent = JSON.parse(result.output.choices[0].text);

    // Save study guide to database
    const { data: studyGuide, error: saveError } = await supabase
      .from('study_guides')
      .insert({
        job_description_id: jobDescriptionId,
        user_id: user.id,
        competencies: studyGuideContent.competencies,
        questions: studyGuideContent.questions,
        technical_checklist: studyGuideContent.technical_checklist,
      })
      .select()
      .single();

    if (saveError) {
      throw saveError;
    }

    return new Response(
      JSON.stringify(studyGuide),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
}); 