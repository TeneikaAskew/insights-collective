
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
    console.log("Career advice function called");
    
    // Generate a mock response
    const response = {
      generatedText: `
      **Personalized Career Advice Report**
      
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
      
      By following these recommendations and leveraging your unique strengths, you can build a fulfilling career path aligned with your interests and abilities.`
    };
    
    console.log("Generated response successfully");
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error(`Error in evaluateCareerAdvice function: ${error.message}`);
    return new Response(
      JSON.stringify({ error: "Server error processing request" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
