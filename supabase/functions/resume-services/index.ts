
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serveBulletImprover } from "./bulletImprover.ts";
import { corsHeaders } from "../resume-analyzer/utils.ts";

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Get the request path
  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();
  
  // Route to the appropriate service
  if (path === 'detect-sentences') {
    // We'll implement a simple sentence detector here since the original module is missing
    return await serveSentenceDetector()(req);
  } else if (path === 'improve-bullet') {
    return await serveBulletImprover()(req);
  } else {
    return new Response(
      JSON.stringify({ 
        error: "Invalid endpoint", 
        available: [
          "/detect-sentences", 
          "/improve-bullet"
        ] 
      }),
      { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

// Add a simple sentence detector service
function serveSentenceDetector() {
  return async (req: Request) => {
    try {
      const { text } = await req.json();
      
      if (!text || typeof text !== 'string') {
        return new Response(
          JSON.stringify({ error: "Missing or invalid text parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Simple sentence extraction logic
      const sentences = text
        .split(/(?<=[.!?])\s+(?=[A-Z])/)
        .map(s => s.replace(/\r?\n/g, ' ').trim())
        .filter(s => s.length > 15);
      
      return new Response(
        JSON.stringify({ sentences }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error in sentence detector service:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to detect sentences" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  };
}
