
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the Admin key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the user is authenticated and is an admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check rate limiting first
    const clientIP = req.headers.get("X-Forwarded-For") || req.headers.get("X-Real-IP") || "unknown";
    const { data: rateLimitCheck, error: rateLimitError } = await supabaseClient
      .rpc('check_debug_token_rate_limit', {
        requesting_user_id: user.id,
        requesting_ip: clientIP
      });

    if (rateLimitError || !rateLimitCheck) {
      await supabaseClient.rpc('log_security_event', {
        p_user_id: user.id,
        p_event_type: 'debug_token_rate_limit_exceeded',
        p_severity: 'warning',
        p_description: 'Rate limit exceeded for debug token access',
        p_metadata: { 
          user_agent: req.headers.get("User-Agent"),
          ip: clientIP
        }
      });
      
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check admin access using secure function
    const { data: hasAdminAccess, error: adminCheckError } = await supabaseClient
      .rpc('has_admin_access', { user_id_param: user.id });
    
    if (adminCheckError || !hasAdminAccess) {
      // Log security event for unauthorized access attempt
      await supabaseClient.rpc('log_security_event', {
        p_user_id: user.id,
        p_event_type: 'unauthorized_debug_token_access',
        p_severity: 'warning',
        p_description: 'Non-admin user attempted to access debug token',
        p_metadata: { 
          user_agent: req.headers.get("User-Agent"),
          ip: req.headers.get("X-Forwarded-For") || req.headers.get("X-Real-IP")
        }
      });
      
      return new Response(
        JSON.stringify({ error: "Unauthorized. Admin access required." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log successful admin access
    await supabaseClient.rpc('log_security_event', {
      p_user_id: user.id,
      p_event_type: 'debug_token_access',
      p_severity: 'info',
      p_description: 'Admin user accessed debug token',
      p_metadata: { 
        user_agent: req.headers.get("User-Agent"),
        ip: req.headers.get("X-Forwarded-For") || req.headers.get("X-Real-IP")
      }
    });

    // Retrieve the debug token from environment variables
    const debugToken = Deno.env.get("DEBUGGING_TOKEN");
    
    if (!debugToken) {
      return new Response(
        JSON.stringify({ error: "Debug token not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ token: debugToken }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
