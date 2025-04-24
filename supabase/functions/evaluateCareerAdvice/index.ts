
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
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log the incoming request for debugging
    console.log("Request received:", req.method, req.url);
    console.log("Request headers:", Object.fromEntries(req.headers.entries()));
    
    // Parse the request body
    let body: RequestPayload;
    const contentType = req.headers.get('content-type') || '';
    
    try {
      if (contentType.includes('application/json')) {
        const text = await req.text();
        console.log("Raw request body:", text);
        
        if (!text) {
          throw new Error("Empty request body");
        }
        
        body = JSON.parse(text);
      } else {
        body = await req.json();
      }
      console.log("Successfully parsed request body:", body);
    } catch (error) {
      console.error("Error parsing request body:", error);
      return new Response(
        JSON.stringify({ 
          error: "Invalid request body format", 
          details: error.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate required fields
    const { prompt, pathwayQuestions, pathwayAnswers, resumeText } = body;
    
    if (!prompt || !pathwayQuestions || !pathwayAnswers) {
      console.error("Missing required fields:", {
        hasPrompt: !!prompt,
        hasPathwayQuestions: !!pathwayQuestions,
        hasPathwayAnswers: !!pathwayAnswers
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields",
          received: {
            prompt: !!prompt,
            pathwayQuestions: !!pathwayQuestions,
            pathwayAnswers: !!pathwayAnswers
          }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For now, return a mock response for testing purposes
    // In production, this would call an AI service or process the data
    const result = generateMockCareerAdviceResponse(pathwayAnswers);
    
    console.log("Successfully generated career advice response");
    
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
