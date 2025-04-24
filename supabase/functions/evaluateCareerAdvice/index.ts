
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

interface PathwayQuestion {
  id: string;
  label: string;
  placeholder: string;
}

interface RequestPayload {
  prompt: string;
  pathwayQuestions: PathwayQuestion[];
  pathwayAnswers: Record<string, string>;
  resumeText?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log the incoming request for debugging
    console.log(`Request received: ${req.method} ${req.url}`);
    console.log(`Headers:`, Object.fromEntries(req.headers.entries()));
    
    // Read the request body
    const bodyText = await req.text();
    console.log(`Request body length: ${bodyText.length} bytes`);
    
    if (!bodyText || bodyText.trim() === '') {
      console.error("Empty request body received");
      return new Response(
        JSON.stringify({ error: "Empty request body" }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Parse the JSON body
    let body: RequestPayload;
    try {
      body = JSON.parse(bodyText);
      console.log("Successfully parsed request body:", body);
    } catch (parseError) {
      console.error(`Error parsing JSON: ${parseError.message}`);
      console.error(`Raw body content: ${bodyText.substring(0, 200)}...`);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body", details: parseError.message }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Validate required fields
    if (!body.prompt) {
      return new Response(
        JSON.stringify({ error: "Missing prompt field" }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    if (!body.pathwayQuestions || !Array.isArray(body.pathwayQuestions)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid pathwayQuestions field" }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    if (!body.pathwayAnswers || typeof body.pathwayAnswers !== 'object') {
      return new Response(
        JSON.stringify({ error: "Missing or invalid pathwayAnswers field" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate career advice response
    const result = generateMockCareerAdviceResponse(body.pathwayAnswers);
    
    console.log("Successfully generated career advice response");
    
    // Return the result
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error(`Error in evaluateCareerAdvice function: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    
    return new Response(
      JSON.stringify({ 
        error: "Server error processing request", 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// Helper function to generate a mock response
function generateMockCareerAdviceResponse(answers: Record<string, string>) {
  const userName = answers.q1 ? answers.q1.split(' ')[0] : 'User';
  
  return {
    generatedText: `
      **Personalized Career Advice Report for ${userName}**
      
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
}
