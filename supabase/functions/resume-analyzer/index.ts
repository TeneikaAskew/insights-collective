
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { analyzeResume } from "./analyzeResume.ts";
import { corsHeaders } from "./utils.ts";
import { createErrorResponse } from "./fallbackAnalysis.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Parse the request body
    const requestData = await req.json();
    const { resumeText, userId } = requestData;
    
    // Analyze the resume
    const analysis = await analyzeResume(resumeText, userId);
    
    // Return the analysis
    return new Response(
      JSON.stringify(analysis),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
    
  } catch (error) {
    console.error('Error processing request:', error.message);
    
    // Return error response with minimal valid analysis
    return new Response(
      JSON.stringify(createErrorResponse(error.message)),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
})
