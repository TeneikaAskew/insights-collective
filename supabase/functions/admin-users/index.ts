
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};

serve(async (req) => {
  // Handle CORS preflight requests properly
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    // Create a Supabase client with the auth header
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the request body
    const { action, userId, data } = await req.json();

    // Verify that the requesting user is an admin before proceeding
    const adminClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: sessionData, error: sessionError } = await adminClient.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      throw new Error('Invalid session');
    }
    
    const { data: userData, error: userError } = await adminClient
      .from('profiles')
      .select('roles')
      .eq('id', sessionData.session.user.id)
      .single();
    
    if (userError || !userData || !userData.roles?.includes('admin')) {
      throw new Error('Unauthorized - Admin access required');
    }

    // Handle different actions
    let result = null;
    
    if (action === 'listUsers') {
      // Get users with admin privilege
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) throw authError;
      
      // Get profiles for additional data
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');
      
      if (profilesError) throw profilesError;
      
      // Merge the data
      const users = authUsers.users.map(user => {
        const profile = profiles.find(p => p.id === user.id) || {};
        return {
          id: user.id,
          email: user.email,
          phone: user.phone,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          providers: user.app_metadata?.providers || [],
          first_name: profile.first_name || user.user_metadata?.first_name || '',
          last_name: profile.last_name || user.user_metadata?.last_name || '',
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          role: profile.role || 'student',
          roles: profile.roles || [profile.role || 'student'],
          user_metadata: user.user_metadata
        };
      });
      
      result = { users };
    } 
    else if (action === 'updateUserRole') {
      if (!userId || !data?.roles) {
        throw new Error('Missing user ID or roles data');
      }
      
      // Update the user's roles in the profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          roles: data.roles,
          role: data.roles.includes('admin') ? 'admin' : 
                data.roles.includes('instructor') ? 'instructor' : 'student'
        })
        .eq('id', userId);
      
      if (updateError) throw updateError;
      
      result = { success: true, message: 'User roles updated' };
    } 
    else if (action === 'deleteUser') {
      if (!userId) {
        throw new Error('Missing user ID');
      }
      
      // Delete the user using Supabase admin API
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      
      if (deleteError) throw deleteError;
      
      result = { success: true, message: 'User deleted' };
    } 
    else if (action === 'resetPassword') {
      if (!data?.email) {
        throw new Error('Missing email');
      }
      
      // Send password reset email
      const { error: resetError } = await supabase.auth.admin.sendPasswordResetEmail(data.email);
      
      if (resetError) throw resetError;
      
      result = { success: true, message: 'Password reset email sent' };
    } 
    else {
      throw new Error(`Unknown action: ${action}`);
    }
    
    return new Response(
      JSON.stringify(result),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } 
  catch (error) {
    console.error('Error:', error.message);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
      }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});
