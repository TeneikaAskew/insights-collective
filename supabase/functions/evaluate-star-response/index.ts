
// Follow Deno and Edge Functions v2 URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders } from "../_shared/utils.ts";

const TOGETHER_API_KEY = Deno.env.get("TOGETHER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function evaluateStarResponse(responseId: string) {
  // Create Supabase client with service role key for admin access
  const supabase = createClient(
    SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch the STAR response and related question
  const { data: starResponse, error: responseError } = await supabase
    .from("star_responses")
    .select("*, questions:question_id(*)")
    .eq("id", responseId)
    .single();

  if (responseError) {
    throw responseError;
  }

  if (!starResponse) {
    throw new Error("STAR response not found");
  }

  // Call the AI model to evaluate the STAR response
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
          content: `You are an interview coach specializing in evaluating STAR (Situation, Task, Action, Result) responses. Provide detailed, objective feedback on interview responses.`
        },
        {
          role: "user",
          content: `Please evaluate this STAR response for the following interview question:

Question: ${starResponse.questions ? starResponse.questions.question : "Behavioral interview question"}
Target Competency: ${starResponse.questions ? starResponse.questions.targetCompetency : "Not specified"}

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

Return ONLY the JSON object with no additional explanation or text.`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
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
  let feedbackData;
  try {
    // Try to parse the content directly
    feedbackData = JSON.parse(content);
  } catch (e) {
    console.error("Failed to parse JSON directly:", e);
    
    // Try to extract JSON using regex as a fallback
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        feedbackData = JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.error("Failed to parse extracted JSON:", e2);
        throw new Error("Failed to parse AI response as JSON");
      }
    } else {
      throw new Error("Could not extract JSON from AI response");
    }
  }

  // Update the STAR response with the feedback
  const { data: updatedResponse, error: updateError } = await supabase
    .from("star_responses")
    .update({ ai_feedback: feedbackData })
    .eq("id", responseId)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  return feedbackData;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { responseId } = await req.json();

    if (!responseId) {
      return new Response(
        JSON.stringify({ error: "STAR response ID is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const feedbackData = await evaluateStarResponse(responseId);

    return new Response(JSON.stringify({ ai_feedback: feedbackData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error evaluating STAR response:", error);
    
    return new Response(
      JSON.stringify({ error: error.message || "Failed to evaluate STAR response" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
