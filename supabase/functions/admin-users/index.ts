
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
    // Create a Supabase client with the service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, userId, data } = await req.json();

    // Get the user making the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: currentUser } } = await supabase.auth.getUser(token);

    if (!currentUser) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if the user is an admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("roles")
      .eq("id", currentUser.id)
      .single();

    if (profileError || !profile?.roles?.includes("admin")) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Actions
    let result;
    let error;

    switch (action) {
      case "listUsers":
        // First get all users from auth
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        
        if (authError) {
          throw authError;
        }

        // Get all profiles
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*");

        if (profilesError) {
          throw profilesError;
        }

        // Merge the data
        const mergedUsers = authUsers.users.map(user => {
          const profile = profiles.find(p => p.id === user.id) || {};
          
          // Extract provider information from user's identities
          const providers = user.identities?.map(identity => identity.provider) || [];
          
          // Ensure roles is an array
          let roles = profile.roles;
          if (!roles) {
            roles = profile.role ? [profile.role, 'student'] : ['student'];
          } else if (typeof roles === 'string') {
            roles = roles.split(',').map(r => r.trim());
          }
          
          return {
            id: user.id,
            email: user.email || '',
            phone: user.phone || '',
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            providers: providers,
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            avatar_url: profile.avatar_url || user.user_metadata?.avatar_url || '',
            bio: profile.bio || '',
            role: profile.role || 'student',
            roles: roles,
            user_metadata: user.user_metadata
          };
        });

        result = { users: mergedUsers };
        break;

      case "updateUserRole":
        if (!userId || !data?.roles) {
          throw new Error("Missing userId or roles");
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ roles: data.roles })
          .eq("id", userId);

        if (updateError) {
          throw updateError;
        }
        
        result = { success: true };
        break;

      case "deleteUser":
        if (!userId) {
          throw new Error("Missing userId");
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
        
        if (deleteError) {
          throw deleteError;
        }
        
        result = { success: true };
        break;

      case "resetPassword":
        if (!data?.email) {
          throw new Error("Missing email");
        }

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(data.email, {
          redirectTo: `${req.headers.get("origin")}/reset-password`,
        });
        
        if (resetError) {
          throw resetError;
        }
        
        result = { success: true };
        break;

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
