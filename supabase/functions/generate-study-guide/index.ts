import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

interface StudyGuideRequest {
  jobDescription: string;
}

interface StudyGuideSection {
  title: string;
  topics: string[];
  resources: Array<{
    title: string;
    url: string;
    type: 'documentation' | 'tutorial' | 'video' | 'article';
  }>;
  practiceQuestions: string[];
}

interface StudyGuide {
  title: string;
  overview: string;
  sections: StudyGuideSection[];
  estimatedStudyTime: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobDescription } = await req.json() as StudyGuideRequest;

    const prompt = `As an expert technical interviewer, analyze this job description and create a comprehensive study guide:

Job Description:
${jobDescription}

Create a detailed study guide that includes:
1. Key technical skills and concepts to master
2. Recommended learning resources (documentation, tutorials, videos)
3. Practice questions and exercises
4. Estimated study time

Format your response in JSON with the following structure:
{
  "title": string,
  "overview": string,
  "sections": [
    {
      "title": string,
      "topics": string[],
      "resources": [
        {
          "title": string,
          "url": string,
          "type": "documentation" | "tutorial" | "video" | "article"
        }
      ],
      "practiceQuestions": string[]
    }
  ],
  "estimatedStudyTime": string
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
            content: 'You are an expert technical interviewer and career coach.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Together.ai API error: ${response.statusText}`);
    }

    const data = await response.json();
    const studyGuide = JSON.parse(data.choices[0].message.content) as StudyGuide;

    // Store the study guide in the database
    const { data: savedGuide, error } = await supabaseClient
      .from('study_guides')
      .insert([
        {
          title: studyGuide.title,
          content: studyGuide,
          job_description: jobDescription,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify(savedGuide),
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