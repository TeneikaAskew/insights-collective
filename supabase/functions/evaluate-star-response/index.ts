
// Follow Deno and Edge Functions v2 URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, handleError, safeParseJSON } from "../_shared/utils.ts";

const TOGETHER_API_KEY = Deno.env.get("TOGETHER_API_KEY");
const GROQ = Deno.env.get("GROQ");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function evaluateStarResponse(responseId: string) {
  console.log(`[evaluate-star-response] Starting process for response ID: ${responseId}`);
  
  // Log environment variables availability (not their values for security)
  console.log(`[evaluate-star-response] Environment check: TOGETHER_API_KEY exists: ${!!TOGETHER_API_KEY}`);
  console.log(`[evaluate-star-response] Environment check: SUPABASE_URL exists: ${!!SUPABASE_URL}`);
  console.log(`[evaluate-star-response] Environment check: SUPABASE_SERVICE_ROLE_KEY exists: ${!!SUPABASE_SERVICE_ROLE_KEY}`);

  try {
    // Create Supabase client with service role key for admin access
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`[evaluate-star-response] Supabase client created successfully`);

    // Fetch the STAR response first
    console.log(`[evaluate-star-response] Fetching STAR response with ID: ${responseId}`);
    const { data: starResponse, error: responseError } = await supabase
      .from("star_responses")
      .select("*")
      .eq("id", responseId)
      .single();

    if (responseError) {
      console.error(`[evaluate-star-response] Error fetching STAR response:`, responseError);
      throw handleError(responseError);
    }

    if (!starResponse) {
      console.error(`[evaluate-star-response] STAR response not found with ID: ${responseId}`);
      throw new Error("STAR response not found");
    }

    console.log(`[evaluate-star-response] STAR response fetched successfully:`, {
      id: starResponse.id,
      question_id: starResponse.question_id,
      situation_length: starResponse.situation?.length || 0,
      task_length: starResponse.task?.length || 0,
      action_length: starResponse.action?.length || 0,
      result_length: starResponse.result?.length || 0
    });

    // Separately fetch the question based on question_id
    let questionData = null;
    let targetCompetency = "Behavioral competency";
    let questionText = "Behavioral interview question";

    // Get the related question if question_id is available
    if (starResponse.question_id) {
      console.log(`[evaluate-star-response] Fetching related question with ID: ${starResponse.question_id}`);
      
      // Try to get the question from study guide questions
      const { data: studyGuides, error: studyGuidesError } = await supabase
        .from("study_guides")
        .select("questions")
        .eq("user_id", starResponse.user_id);
        
      if (studyGuidesError) {
        console.warn(`[evaluate-star-response] Error fetching study guides: ${studyGuidesError.message}`);
      } else if (studyGuides && studyGuides.length > 0) {
        // Look through all questions in all study guides for this user
        for (const guide of studyGuides) {
          if (guide.questions && Array.isArray(guide.questions)) {
            const matchingQuestion = guide.questions.find(q => q.id === starResponse.question_id);
            if (matchingQuestion) {
              console.log(`[evaluate-star-response] Found matching question in study guide`);
              questionData = matchingQuestion;
              questionText = matchingQuestion.question || questionText;
              targetCompetency = matchingQuestion.targetCompetency || targetCompetency;
              break;
            }
          }
        }
      }

      if (!questionData) {
        console.warn(`[evaluate-star-response] Could not find question in study guides, using defaults`);
      }
    }

    // Call the AI model to evaluate the STAR response
    console.log(`[evaluate-star-response] Calling Together AI API to evaluate STAR response`);
    
    const promptContent = `Please evaluate this STAR response for the following interview question:

Question: ${questionText}
Target Competency: ${targetCompetency}

STAR Response:
Situation: ${starResponse.situation}
Task: ${starResponse.task}
Action: ${starResponse.action}
Result: ${starResponse.result}

Evaluate this STAR response and provide feedback in the following JSON format:
{
  "scores": {
    "situation": number (1-10), // How well the situation is described
    "task": number (1-10), // How clearly the task/challenge is explained
    "action": number (1-10), // How effectively actions are described
    "result": number (1-10), // How well the outcomes are quantified
    "overall": number (1-10) // Overall score for the STAR response
  },
  "analysis": {
    "completeness": string, // Comment on whether all STAR elements are present
    "specificity": string, // Comment on level of detail and concrete examples
    "relevance": string, // Comment on relevance to the target competency
    "impact": string, // Comment on how well the response demonstrates impact
    "communication": string // Comment on clarity and conciseness
  },
  "feedback": {
    "strengths": [string], // 3-5 specific strengths of this response
    "improvements": [string], // 3-5 specific areas for improvement
    "suggestions": [string] // 3-5 actionable suggestions to enhance this response
  }
}

Return ONLY the JSON object with no additional explanation or text.`;

    console.log(`[evaluate-star-response] Prompt prepared with length: ${promptContent.length}`);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {//"https://api.groq.com/v1/chat/completions", { //"https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ}`,//${GROQ}`,//${TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",//"meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",//"llama3-8b-8192", //"meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        messages: [
          {
            role: "system",
            content: `You are an interview coach specializing in evaluating STAR (Situation, Task, Action, Result) responses. Provide detailed, objective feedback on interview responses.`
          },
          {
            role: "user",
            content: promptContent
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[evaluate-star-response] AI API error status: ${response.status}`);
      console.error(`[evaluate-star-response] AI API error body:`, errorData);
      throw new Error(`AI API error: ${response.status}`);
    }

    console.log(`[evaluate-star-response] Together AI API response received with status: ${response.status}`);

    // Parse the AI response
    const result = await response.json();
    console.log(`[evaluate-star-response] AI response parsed successfully, model used: ${result.model || 'unknown'}`);
    console.log(`[evaluate-star-response] AI response:`, result);
    const content = result.choices[0].message.content;
    console.log(`[evaluate-star-response] Retrieved content length: ${content?.length || 0}`);

    // Extract JSON from the response using our improved parser
    const parsedResult = safeParseJSON(content);
    
    if (!parsedResult.success || !parsedResult.data) {
      console.error(`[evaluate-star-response] Failed to parse AI response as JSON`);
      throw new Error("Failed to parse AI response");
    }
    
    const feedbackData = parsedResult.data;

    console.log(`[evaluate-star-response] Feedback data structure:`, {
      has_scores: !!feedbackData?.scores,
      has_analysis: !!feedbackData?.analysis,
      has_feedback: !!feedbackData?.feedback,
      overall_score: feedbackData?.scores?.overall
    });

    // Update the STAR response with the feedback
    console.log(`[evaluate-star-response] Updating STAR response with feedback`);
    const { data: updatedResponse, error: updateError } = await supabase
      .from("star_responses")
      .update({ ai_feedback: feedbackData })
      .eq("id", responseId)
      .select()
      .single();

    if (updateError) {
      console.error(`[evaluate-star-response] Error updating STAR response:`, updateError);
      throw handleError(updateError);
    }

    console.log(`[evaluate-star-response] STAR response updated successfully with feedback`);
    return feedbackData;
  } catch (error) {
    console.error(`[evaluate-star-response] Unexpected error:`, error);
    throw handleError(error);
  }
}

serve(async (req) => {
  console.log(`[evaluate-star-response] Received ${req.method} request`);
  const startTime = new Date().getTime();
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log(`[evaluate-star-response] Handling OPTIONS preflight request`);
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    console.log(`[evaluate-star-response] Request received with data:`, {
      has_responseId: !!requestData.responseId
    });
    
    const { responseId } = requestData;

    if (!responseId) {
      console.error(`[evaluate-star-response] Missing STAR response ID in request`);
      return new Response(
        JSON.stringify({ error: "STAR response ID is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`[evaluate-star-response] Processing request for STAR response ID: ${responseId}`);
    const feedbackData = await evaluateStarResponse(responseId);
    console.log(`[evaluate-star-response] Evaluation completed successfully, returning response`);
    console.log("Ending time: ", new Date().toISOString());
    console.log("Time taken: ", new Date().getTime() - startTime);

    return new Response(JSON.stringify({ ai_feedback: feedbackData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error(`[evaluate-star-response] Error in edge function:`, error);

    
    
    return new Response(
      JSON.stringify({ error: error.message || "Failed to evaluate STAR response" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
  
});
