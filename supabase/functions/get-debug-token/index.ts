
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

    // Get the user's profile to check their roles (updated for new roles array)
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("roles")
      .eq("id", user.id)
      .single();

    // Check if user has admin role in the roles array
    const hasAdminRole = profile?.roles?.includes('admin') || false;
    
    if (profileError || !profile || !hasAdminRole) {
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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
