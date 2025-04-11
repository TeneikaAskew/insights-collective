
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serveBulletImprover } from "./bulletImprover.ts";
import { corsHeaders } from "../resume-analyzer/utils.ts";

// Re-export the sentence detector from the analyzer for backwards compatibility
import { detectSentences } from "../resume-analyzer/sentenceDetector.ts";
export { detectSentences };

// Service handler for sentence detection
export function serveSentenceDetector() {
  return async (req: Request) => {
    try {
      const { text } = await req.json();
      
      if (!text || typeof text !== 'string') {
        return new Response(
          JSON.stringify({ error: "Missing or invalid text parameter" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const sentences = await detectSentences(text);
      
      return new Response(
        JSON.stringify({ sentences }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (error) {
      console.error("Error in sentence detector service:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to detect sentences" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  };
}

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
