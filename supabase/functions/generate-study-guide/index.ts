
// Follow Deno and Edge Functions v2 URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, handleError } from "../_shared/utils.ts";

const TOGETHER_API_KEY = Deno.env.get("TOGETHER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function generateStudyGuide(jobDescriptionId: string) {
  console.log(`[generate-study-guide] Starting process for job description ID: ${jobDescriptionId}`);
  
  // Log environment variables availability (not their values for security)
  console.log(`[generate-study-guide] Environment check: TOGETHER_API_KEY exists: ${!!TOGETHER_API_KEY}`);
  console.log(`[generate-study-guide] Environment check: SUPABASE_URL exists: ${!!SUPABASE_URL}`);
  console.log(`[generate-study-guide] Environment check: SUPABASE_SERVICE_ROLE_KEY exists: ${!!SUPABASE_SERVICE_ROLE_KEY}`);

  try {
    // Create Supabase client with service role key for admin access
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`[generate-study-guide] Supabase client created successfully`);

    // Fetch the job description
    console.log(`[generate-study-guide] Fetching job description with ID: ${jobDescriptionId}`);
    const { data: jobDescription, error: jobDescriptionError } = await supabase
      .from("job_descriptions")
      .select("*")
      .eq("id", jobDescriptionId)
      .single();

    if (jobDescriptionError) {
      console.error(`[generate-study-guide] Error fetching job description:`, jobDescriptionError);
      throw handleError(jobDescriptionError);
    }

    if (!jobDescription) {
      console.error(`[generate-study-guide] Job description not found with ID: ${jobDescriptionId}`);
      throw new Error("Job description not found");
    }

    console.log(`[generate-study-guide] Job description fetched successfully:`, {
      id: jobDescription.id,
      user_id: jobDescription.user_id,
      source_type: jobDescription.source_type,
      text_length: jobDescription.raw_text?.length || 0
    });

    // Generate a unique ID for each question
    const generateQuestionId = () => crypto.randomUUID();

    // Call the AI model to analyze the job description and generate a study guide
    console.log(`[generate-study-guide] Calling Together AI API to analyze job description`);
    
    const requestBody = JSON.stringify({
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
    });
    
    console.log(`[generate-study-guide] Request body prepared with length: ${requestBody.length}`);

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOGETHER_API_KEY}`,
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[generate-study-guide] AI API error status: ${response.status}`);
      console.error(`[generate-study-guide] AI API error body:`, errorData);
      throw new Error(`AI API error: ${response.status}`);
    }

    console.log(`[generate-study-guide] Together AI API response received with status: ${response.status}`);

    // Parse the AI response
    const result = await response.json();
    console.log(`[generate-study-guide] AI response parsed successfully, model used: ${result.model || 'unknown'}`);
    
    const content = result.choices[0].message.content;
    console.log(`[generate-study-guide] Retrieved content length: ${content?.length || 0}`);

    // Extract JSON from the response
    let studyGuideData;
    try {
      // Try to parse the content directly
      console.log(`[generate-study-guide] Attempting direct JSON parsing`);
      studyGuideData = JSON.parse(content);
      console.log(`[generate-study-guide] JSON parsed successfully via direct method`);
    } catch (e) {
      console.error(`[generate-study-guide] Failed to parse JSON directly:`, e);
      
      // Try to extract JSON using regex as a fallback
      console.log(`[generate-study-guide] Attempting fallback JSON extraction via regex`);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          studyGuideData = JSON.parse(jsonMatch[0]);
          console.log(`[generate-study-guide] JSON parsed successfully via regex fallback`);
        } catch (e2) {
          console.error(`[generate-study-guide] Failed to parse extracted JSON:`, e2);
          throw handleError(new Error("Failed to parse AI response as JSON"));
        }
      } else {
        console.error(`[generate-study-guide] Could not find JSON in AI response`);
        console.error(`[generate-study-guide] Response content snippet:`, content.substring(0, 100) + '...');
        throw handleError(new Error("Could not extract JSON from AI response"));
      }
    }

    console.log(`[generate-study-guide] Study guide data structure:`, {
      has_competencies: !!studyGuideData?.competencies,
      questions_count: studyGuideData?.questions?.length || 0,
      technical_checklist_count: studyGuideData?.technical_checklist?.length || 0
    });

    // Add UUIDs to questions if they don't have them
    if (studyGuideData && studyGuideData.questions) {
      studyGuideData.questions = studyGuideData.questions.map(question => ({
        ...question,
        id: question.id || generateQuestionId()
      }));
      console.log(`[generate-study-guide] Added/verified UUIDs for ${studyGuideData.questions.length} questions`);
    }

    // Save the study guide to the database
    console.log(`[generate-study-guide] Saving study guide to database for user ID: ${jobDescription.user_id}`);
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
      console.error(`[generate-study-guide] Error saving study guide:`, studyGuideError);
      throw handleError(studyGuideError);
    }

    console.log(`[generate-study-guide] Study guide saved successfully with ID: ${studyGuide.id}`);
    return studyGuideData;
  } catch (error) {
    console.error(`[generate-study-guide] Unexpected error:`, error);
    throw handleError(error);
  }
}

serve(async (req) => {
  console.log(`[generate-study-guide] Received ${req.method} request`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log(`[generate-study-guide] Handling OPTIONS preflight request`);
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    console.log(`[generate-study-guide] Request received with data:`, {
      has_jobDescriptionId: !!requestData.jobDescriptionId
    });
    
    const { jobDescriptionId } = requestData;

    if (!jobDescriptionId) {
      console.error(`[generate-study-guide] Missing job description ID in request`);
      return new Response(
        JSON.stringify({ error: "Job description ID is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`[generate-study-guide] Processing request for job description ID: ${jobDescriptionId}`);
    const studyGuideData = await generateStudyGuide(jobDescriptionId);
    console.log(`[generate-study-guide] Study guide generated successfully, returning response`);

    return new Response(JSON.stringify(studyGuideData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(`[generate-study-guide] Error in edge function:`, error);
    
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate study guide" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
