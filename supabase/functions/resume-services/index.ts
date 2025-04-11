
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serveSentenceDetector } from "./sentenceDetector.ts";
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
