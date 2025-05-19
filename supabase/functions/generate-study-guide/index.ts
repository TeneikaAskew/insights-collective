
// Follow Deno and Edge Functions v2 URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders } from "../_shared/utils.ts";

const TOGETHER_API_KEY = Deno.env.get("TOGETHER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function generateStudyGuide(jobDescriptionId: string) {
  // Create Supabase client with service role key for admin access
  const supabase = createClient(
    SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch the job description
  const { data: jobDescription, error: jobDescriptionError } = await supabase
    .from("job_descriptions")
    .select("*")
    .eq("id", jobDescriptionId)
    .single();

  if (jobDescriptionError) {
    throw jobDescriptionError;
  }

  if (!jobDescription) {
    throw new Error("Job description not found");
  }

  // Generate a unique ID for each question
  const generateQuestionId = () => crypto.randomUUID();

  // Call the AI model to analyze the job description and generate a study guide
  const response = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOGETHER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      messages: [
        {
          role: "system",
          content: `You are an interview preparation expert that helps job seekers analyze job descriptions and prepare for interviews. You will create a comprehensive study guide based on the job description provided.`
        },
        {
          role: "user",
          content: `Please analyze this job description and create a detailed interview preparation guide:

${jobDescription.raw_text}

Output a complete JSON object with the following structure:
{
  "competencies": {
    "technical": [string], // List of required technical skills/knowledge
    "behavioral": [string] // List of required soft skills and behavioral traits
  },
  "questions": [
    {
      "id": "unique-id", // A UUID for this question (I'll replace these later)
      "type": "behavioral" or "technical", // Type of question
      "question": "The full question text?", // The interview question
      "targetCompetency": "Which competency this tests for", // The main competency this question tests
      "preparationTips": "Tips for answering this question well" // Brief preparation tips
    }
  ],
  "technical_checklist": [
    {
      "skill": "Name of technical skill", // Specific technical skill
      "importance": "high" or "medium" or "low", // Importance level
      "resources": ["Resource URL or name"] // Optional list of resources to learn/practice
    }
  ]
}

Keep your output format strictly as valid JSON without any additional explanation or text. Return ONLY the JSON object.`
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("AI API error:", errorData);
    throw new Error(`AI API error: ${response.status}`);
  }

  // Parse the AI response
  const result = await response.json();
  const content = result.choices[0].message.content;

  // Extract JSON from the response
  let studyGuideData;
  try {
    // Try to parse the content directly
    studyGuideData = JSON.parse(content);
  } catch (e) {
    console.error("Failed to parse JSON directly:", e);
    
    // Try to extract JSON using regex as a fallback
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        studyGuideData = JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.error("Failed to parse extracted JSON:", e2);
        throw new Error("Failed to parse AI response as JSON");
      }
    } else {
      throw new Error("Could not extract JSON from AI response");
    }
  }

  // Add UUIDs to questions if they don't have them
  if (studyGuideData && studyGuideData.questions) {
    studyGuideData.questions = studyGuideData.questions.map(question => ({
      ...question,
      id: question.id || generateQuestionId()
    }));
  }

  // Save the study guide to the database
  const { data: studyGuide, error: studyGuideError } = await supabase
    .from("study_guides")
    .insert({
      user_id: jobDescription.user_id,
      job_description_id: jobDescription.id,
      competencies: studyGuideData.competencies,
      questions: studyGuideData.questions,
      technical_checklist: studyGuideData.technical_checklist
    })
    .select()
    .single();

  if (studyGuideError) {
    throw studyGuideError;
  }

  return studyGuideData;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobDescriptionId } = await req.json();

    if (!jobDescriptionId) {
      return new Response(
        JSON.stringify({ error: "Job description ID is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const studyGuideData = await generateStudyGuide(jobDescriptionId);

    return new Response(JSON.stringify(studyGuideData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error generating study guide:", error);
    
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate study guide" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
