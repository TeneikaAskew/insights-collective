import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

let body;
try {
  body = await req.text();//json();
} catch (err) {
  console.error("Invalid JSON body:", err);
  return new Response(
    JSON.stringify({ error: "Invalid JSON body" }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
    console.log("Body:", body)

    const prompt = body.prompt;
    console.log("Prompt: ", prompt)
    
    const pathwayQuestions = body.pathwayQuestions || body.quizQuestions;
    console.log("PathwayQuestions: ", PathwayQuestions)
    
    const pathwayAnswers = body.pathwayAnswers || body.quizAnswers;
    console.log("pathwayAnswers: ", pathwayAnswers)
    
    const resumeText = body.resumeText;    
    console.log("resumeText: ", resumeText)

    if (!prompt || !pathwayQuestions || !pathwayAnswers) {
      return new Response(
        JSON.stringify({ error: "Missing required fields." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Construct prompt
    let combinedPrompt = `${prompt}\n\nUser's pathway answers:\n`;
    for (const question of pathwayQuestions) {
      const answer = pathwayAnswers[question.id] || "";
      combinedPrompt += `${question.label || question.id}: ${answer}\n`;
    }
    if (resumeText) {
      combinedPrompt += `\nUser Resume Text:\n${resumeText}\n`;
    }

    const messages = [
      {
        role: "system",
        content: "You are a helpful career coach assistant that synthesizes data to give clear career advice.",
      },
      {
        role: "user",
        content: combinedPrompt,
      },
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "compound-beta-mini",
        messages,
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GROQ API Error:", errorText);
      return new Response(
        JSON.stringify({ error: "GROQ API error", details: errorText }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      console.error("Failed to parse JSON from GROQ:", jsonErr);
      return new Response(
        JSON.stringify({
          error: "Failed to parse GROQ JSON response",
          details: jsonErr.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const generatedText = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ generatedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in evaluateCareerAdvice function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
