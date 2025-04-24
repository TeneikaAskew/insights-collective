
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

    // Check content type
    const contentType = req.headers.get('content-type');
    console.log("Content-Type:", contentType);
    
    // Get the raw text body first for debugging
    const rawBody = await req.text();
    console.log("Raw request body length:", rawBody.length);
    console.log("Raw request body (first 200 chars):", rawBody.substring(0, 200));

    // If body is empty, return an error
    if (!rawBody || rawBody.trim() === '') {
      return new Response(
        JSON.stringify({ 
          error: "Empty request body", 
          details: "The request body is empty or missing"
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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
    console.log("Processing career advice with valid data");
    
    // For now, returning a mock response for testing purposes
    // In a real implementation, this would be where your AI or analysis logic goes
    const result = {
      analysis: "This is a personalized career analysis based on your answers.",
      recommendations: [
        "Based on your skills and preferences, consider roles in data science.",
        "Your strength in communication would be valuable in project management."
      ],
      generatedText: `
        **Personalized Career Advice Report for ${body.pathwayAnswers[0] || 'You'}**
        
        **Summary:** 
        Based on your responses, you show strong analytical skills and an interest in problem-solving. Your background suggests you would excel in roles that combine technical expertise with strategic thinking.
        
        **Recommended Roles:** 
        1. Data Analyst
        2. Business Intelligence Specialist
        3. Project Manager with technical focus
        
        **Skills and Matching Courses:**
        | Skill | Course |
        | ----- | ------ |
        | Data Analysis | Advanced SQL for Analysts |
        | Project Management | Agile Certification Prep |
        | Communication | Executive Presentation Skills |
        
        **Next-Step Career Recommendations:**
        1. Gain certification in your primary technical area
        2. Develop a portfolio showcasing your analytical projects
        3. Connect with professionals in your target industry
        
        **Roles that Might be Right for You:**
        1. Junior Data Scientist
        2. Business Analyst
        3. Research Associate
        
        **Path to Your Aspirational Role:**
        1. Start in an entry-level analytical position
        2. Gain 2-3 years of hands-on experience
        3. Pursue advanced certification or education
        4. Move into a specialized or senior role
        
        **Remote Work Considerations:**
        Remote opportunities are abundant in data-focused careers. Consider highlighting your self-motivation and digital collaboration skills.
        
        By following these recommendations and leveraging your unique strengths, you can build a fulfilling career path aligned with your interests and abilities.
      `
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
