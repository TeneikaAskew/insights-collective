
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log the raw request for debugging
    console.log("Received request:", req.method, req.url);
    console.log("Request headers:", Object.fromEntries(req.headers.entries()));

    // Get the raw text body first for debugging
    const rawBody = await req.text();
    console.log("Raw request body:", rawBody);

    // Parse the body
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("Error parsing JSON body:", parseError);
      return new Response(
        JSON.stringify({ 
          error: "Invalid JSON payload", 
          details: parseError.message,
          receivedBody: rawBody.substring(0, 200) // First 200 chars for debugging
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log("Parsed body:", body);

    // Validate required fields
    const { prompt, pathwayQuestions, pathwayAnswers, resumeText } = body || {};
    const missingFields = [];
    
    if (!prompt) missingFields.push("prompt");
    if (!pathwayQuestions || !Array.isArray(pathwayQuestions) || pathwayQuestions.length === 0) {
      missingFields.push("pathwayQuestions");
    }
    if (!pathwayAnswers || typeof pathwayAnswers !== 'object' || Object.keys(pathwayAnswers).length === 0) {
      missingFields.push("pathwayAnswers");
    }

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: `Missing or invalid fields: ${missingFields.join(", ")}`, 
          receivedKeys: body ? Object.keys(body) : [] 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Process the career advice request
    // This is where your existing processing logic would go
    console.log("Processing career advice with valid data");

    // Mock response for testing
    const result = {
      analysis: "Career analysis based on provided data",
      recommendations: ["Recommendation 1", "Recommendation 2"]
    };

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error("Error in evaluateCareerAdvice function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Server error processing request", 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
