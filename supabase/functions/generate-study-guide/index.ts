
// Follow Deno and Edge Functions v2 URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, handleError, safeParseJSON } from "../_shared/utils.ts";
import { requireUser } from "../_shared/auth.ts";
import { callGroq, GroqRateLimitError, rateLimitResponse } from "../_shared/groq.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GROQ_API_KEY = Deno.env.get("GROQ");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface AssessmentQuestion {
  question_id: string;
  assessment_area: string;
  question_text: string;
  question_type: string;
}

interface SelectedAssessmentArea {
  assessment_area: string;
  relevance_score: number;
  reasoning: string;
  selected_questions: AssessmentQuestion[];
}

async function selectRelevantAssessmentAreas(jobDescription: string): Promise<SelectedAssessmentArea[]> {
  console.log(`[selectRelevantAssessmentAreas] Starting assessment area selection`);
  
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  // Fetch all assessment areas and their definitions
  const { data: assessmentAreas, error: areasError } = await supabase
    .from('assessment_areas')
    .select('*');
    
  if (areasError) {
    console.error(`[selectRelevantAssessmentAreas] Error fetching assessment areas:`, areasError);
    throw areasError;
  }
  
  console.log(`[selectRelevantAssessmentAreas] Found ${assessmentAreas?.length || 0} assessment areas`);
  
  // Fetch all assessment questions
  const { data: allQuestions, error: questionsError } = await supabase
    .from('assessment_questions')
    .select('*');
    
  if (questionsError) {
    console.error(`[selectRelevantAssessmentAreas] Error fetching questions:`, questionsError);
    throw questionsError;
  }
  
  console.log(`[selectRelevantAssessmentAreas] Found ${allQuestions?.length || 0} assessment questions`);

  const selectionPrompt = `Analyze this job description and select the 2 most relevant assessment areas from the provided list. For each selected area, choose 2 specific questions that would best assess a candidate for this role.

Job Description:
${jobDescription}

Available Assessment Areas:
${assessmentAreas?.map(area => `${area.name}: ${area.definition} - Key Focus: ${area.key_focus_areas}`).join('\n\n')}

Available Questions by Assessment Area:
${assessmentAreas?.map(area => {
  const areaQuestions = allQuestions?.filter(q => q.assessment_area === area.name) || [];
  return `${area.name}:\n${areaQuestions.map(q => `- ${q.question_id}: ${q.question_text}`).join('\n')}`;
}).join('\n\n')}

Select exactly 2 assessment areas that are most relevant to this job description. For each selected area, choose 2 questions that would best evaluate a candidate's competency in that area for this specific role.

Return your response in this exact JSON format:
{
  "selected_areas": [
    {
      "assessment_area": "Assessment Area Name",
      "relevance_score": number (1-10),
      "reasoning": "Why this assessment area is relevant to the job",
      "selected_questions": [
        {
          "question_id": "Question ID from the list",
          "assessment_area": "Assessment Area Name",
          "question_text": "Full question text",
          "question_type": "Behavioral"
        },
        {
          "question_id": "Question ID from the list", 
          "assessment_area": "Assessment Area Name",
          "question_text": "Full question text",
          "question_type": "Behavioral"
        }
      ]
    },
    {
      "assessment_area": "Second Assessment Area Name",
      "relevance_score": number (1-10),
      "reasoning": "Why this assessment area is relevant to the job",
      "selected_questions": [
        {
          "question_id": "Question ID from the list",
          "assessment_area": "Second Assessment Area Name", 
          "question_text": "Full question text",
          "question_type": "Behavioral"
        },
        {
          "question_id": "Question ID from the list",
          "assessment_area": "Second Assessment Area Name",
          "question_text": "Full question text", 
          "question_type": "Behavioral"
        }
      ]
    }
  ]
}

Return ONLY the JSON object with no additional text.`;

  console.log(`[selectRelevantAssessmentAreas] Calling AI for assessment area selection`);

  const result = await callGroq(GROQ_API_KEY!, {
      // Replaces llama3-8b-8192, decommissioned 2025-08-30. This call sits
      // inside a try/catch that continues on failure, so the dead model never
      // surfaced an error - guides just generated without behavioural questions.
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system", 
          content: "You are an expert in behavioral assessment and talent evaluation. Analyze job descriptions to select the most relevant assessment areas and behavioral questions for interview preparation."
        },
        {
          role: "user",
          content: selectionPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
  }, "generate-study-guide");

  const content = result.choices[0].message.content;
  
  console.log(`[selectRelevantAssessmentAreas] AI response received, parsing...`);
  
  const parsedResult = safeParseJSON(content);
  if (!parsedResult.success || !parsedResult.data?.selected_areas) {
    console.error(`[selectRelevantAssessmentAreas] Failed to parse AI response:`, content);
    throw new Error("Failed to parse assessment areas selection");
  }
  
  console.log(`[selectRelevantAssessmentAreas] Successfully selected ${parsedResult.data.selected_areas.length} assessment areas`);
  return parsedResult.data.selected_areas;
}

async function generateStudyGuide(jobDescriptionId: string, callerId: string) {
  console.log(`[generateStudyGuide] Starting enhanced study guide generation for job description ID: ${jobDescriptionId}`);
  
  try {
    // Create Supabase client with service role key for admin access
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    console.log(`[generateStudyGuide] Supabase client created successfully`);

    // Fetch the job description
    console.log(`[generateStudyGuide] Fetching job description with ID: ${jobDescriptionId}`);
    const { data: jobDescription, error: jobDescriptionError } = await supabase
      .from("job_descriptions")
      .select("*")
      .eq("id", jobDescriptionId)
      .single();

    if (jobDescriptionError) {
      console.error(`[generateStudyGuide] Error fetching job description:`, jobDescriptionError);
      throw handleError(jobDescriptionError);
    }

    // Service-role client bypasses RLS, so ownership is re-checked here. A bare
    // job-description id previously let anyone read someone else's job posting
    // and insert a study_guides row owned by that victim.
    if (jobDescription && jobDescription.user_id !== callerId) {
      console.warn(`[generateStudyGuide] Caller ${callerId} does not own job description ${jobDescriptionId}`);
      throw new Error("Job description not found");
    }

    if (!jobDescription) {
      console.error(`[generateStudyGuide] Job description not found with ID: ${jobDescriptionId}`);
      throw new Error("Job description not found");
    }

    console.log(`[generateStudyGuide] Job description fetched successfully`);

    // Generate a unique ID for each question
    const generateQuestionId = () => crypto.randomUUID();

    // Call the AI model to analyze the job description and generate the original study guide
    console.log(`[generateStudyGuide] Calling Together AI API to analyze job description for original questions`);
    
    const originalStudyGuidePrompt = `Please analyze this job description and create a detailed interview preparation guide:

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

Keep your output format strictly as valid JSON without any additional explanation or text. Return ONLY the JSON object.`;

    const originalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an interview preparation expert that helps job seekers analyze job descriptions and prepare for interviews. You will create a comprehensive study guide based on the job description provided.`
          },
          {
            role: "user",
            content: originalStudyGuidePrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      }),
    });

    if (!originalResponse.ok) {
      const errorData = await originalResponse.text();
      console.error(`[generateStudyGuide] AI API error:`, errorData);
      throw new Error(`AI API error: ${originalResponse.status}`);
    }

    console.log(`[generateStudyGuide] Original study guide response received`);

    // Parse the original AI response
    const originalResult = await originalResponse.json();
    const originalContent = originalResult.choices[0].message.content;

    // Extract JSON from the response using our improved parser
    const originalParsedResult = safeParseJSON(originalContent);
    
    if (!originalParsedResult.success || !originalParsedResult.data) {
      console.error(`[generateStudyGuide] Failed to parse original AI response as JSON`);
      throw new Error("Failed to parse original AI response");
    }
    
    const originalStudyGuideData = originalParsedResult.data;

    console.log(`[generateStudyGuide] Original study guide parsed successfully, ${originalStudyGuideData?.questions?.length || 0} questions generated`);

    // Add UUIDs to original questions if they don't have them
    if (originalStudyGuideData && originalStudyGuideData.questions) {
      originalStudyGuideData.questions = originalStudyGuideData.questions.map(question => ({
        ...question,
        id: question.id || generateQuestionId(),
        isAssessmentQuestion: false,
        assessmentArea: null
      }));
    }

    // Select relevant assessment areas and questions
    let assessmentAreas = [];
    let assessmentQuestions = [];
    
    try {
      console.log(`[generateStudyGuide] Selecting relevant assessment areas`);
      assessmentAreas = await selectRelevantAssessmentAreas(jobDescription.raw_text);
      
      // Convert assessment questions to the same format as existing questions
      assessmentQuestions = assessmentAreas.flatMap(area => 
        area.selected_questions.map(q => ({
          id: q.question_id,
          type: 'behavioral' as const,
          question: q.question_text,
          targetCompetency: area.assessment_area,
          preparationTips: `This question assesses your ${area.assessment_area} competency. Use the STAR method (Situation, Task, Action, Result) to structure your response. Focus on specific examples that demonstrate your capabilities in this behavioral area.`,
          isAssessmentQuestion: true,
          assessmentArea: area.assessment_area,
          relevanceScore: area.relevance_score,
          relevanceReasoning: area.reasoning
        }))
      );
      
      console.log(`[generateStudyGuide] Successfully selected ${assessmentAreas.length} assessment areas with ${assessmentQuestions.length} questions`);
    } catch (assessmentError) {
      console.warn(`[generateStudyGuide] Failed to select assessment areas, continuing without them:`, assessmentError);
      // Continue without assessment questions if there's an error
    }

    // Combine original questions with assessment questions
    const enhancedQuestions = [
      ...originalStudyGuideData.questions,
      ...assessmentQuestions
    ];

    // Enhanced competencies
    const enhancedCompetencies = {
      ...originalStudyGuideData.competencies,
      behavioral: [
        ...originalStudyGuideData.competencies.behavioral,
        ...assessmentAreas.map(area => area.assessment_area)
      ]
    };

    console.log(`[generateStudyGuide] Enhanced study guide prepared with ${enhancedQuestions.length} total questions`);

    // Save the enhanced study guide to the database
    console.log(`[generateStudyGuide] Saving enhanced study guide to database for user ID: ${jobDescription.user_id}`);
    const { data: studyGuide, error: studyGuideError } = await supabase
      .from("study_guides")
      .insert({
        user_id: jobDescription.user_id,
        job_description_id: jobDescription.id,
        competencies: enhancedCompetencies,
        questions: enhancedQuestions,
        technical_checklist: originalStudyGuideData.technical_checklist,
        assessment_areas: assessmentAreas,
        leadership_areas: [] // For future use
      })
      .select()
      .single();

    if (studyGuideError) {
      console.error(`[generateStudyGuide] Error saving study guide:`, studyGuideError);
      throw handleError(studyGuideError);
    }

    console.log(`[generateStudyGuide] Enhanced study guide saved successfully with ID: ${studyGuide.id}`);
    return studyGuide;
  } catch (error) {
    console.error(`[generateStudyGuide] Unexpected error:`, error);
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

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

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
    const studyGuideData = await generateStudyGuide(jobDescriptionId, auth.user.id);
    console.log(`[generate-study-guide] Enhanced study guide generated successfully, returning response`);

    return new Response(JSON.stringify(studyGuideData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    // A rate limit is not a failure: the request was well formed and the model
    // is willing, the per-minute token budget just has not refreshed yet.
    // Answering 429 with retryAfterMs lets the client wait it out and retry;
    // collapsing it into a 500 told the user the service was down when it was
    // not, and threw the work away.
    if (error instanceof GroqRateLimitError) {
      return rateLimitResponse(error, corsHeaders);
    }

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
