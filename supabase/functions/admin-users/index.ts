
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.20.0'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    // Create a Supabase client with the Auth context of the logged-in user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Create client with user's token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    // Verify user has admin access
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user is an admin
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profileData?.role !== 'admin') {
      console.error('User not admin or profile error:', profileError)
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the action from the request body
    const { action, userId, data: actionData } = await req.json()

    switch (action) {
      case 'listUsers': {
        // Get all users using the admin client
        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (authError) {
          console.error('Error fetching auth users:', authError)
          throw authError
        }

        // Get profiles data to merge with auth data
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('*')

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError)
          throw profilesError
        }

        // Merge auth users with profile data
        const users = authUsers.users.map((authUser) => {
          const profile = profiles.find((p) => p.id === authUser.id) || {}
          return {
            ...authUser,
            ...profile,
          }
        })

        return new Response(JSON.stringify({ users }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'updateUserRole': {
        if (!userId || !actionData?.roles) {
          return new Response(JSON.stringify({ error: 'User ID and roles are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Determine the highest role for the role field
        const highestRole = getHighestRole(actionData.roles)

        // Update the user's profile
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .update({ 
            role: highestRole,
            roles: actionData.roles 
          })
          .eq('id', userId)
          .select()
          .single()

        if (error) {
          console.error('Error updating user role:', error)
          throw error
        }

        return new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'deleteUser': {
        if (!userId) {
          return new Response(JSON.stringify({ error: 'User ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Delete the user - this will cascade to the profile due to foreign key constraints
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (error) {
          console.error('Error deleting user:', error)
          throw error
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'resetPassword': {
        if (!actionData?.email) {
          return new Response(JSON.stringify({ error: 'Email is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Send password reset email
        const { error } = await supabaseAdmin.auth.admin.sendPasswordResetEmail(actionData.email)

        if (error) {
          console.error('Error sending password reset:', error)
          throw error
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default: {
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ error: error.message || 'An error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Helper function to determine highest role
function getHighestRole(roles: string[] = ['student']): string {
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('instructor')) return 'instructor'
  return 'student'
}
