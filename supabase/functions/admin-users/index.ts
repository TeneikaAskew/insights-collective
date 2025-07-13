
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.20.0'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  console.log('[admin-users] Request received:', req.method, req.url);
  
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
    console.log('[admin-users] Auth header present:', !!authHeader);
    console.log('[admin-users] Auth header value:', authHeader?.substring(0, 20) + '...');
    
    if (!authHeader) {
      console.error('[admin-users] No authorization header provided');
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    console.log('[admin-users] Environment variables loaded');
    console.log('[admin-users] Supabase URL:', supabaseUrl);

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Create client with user's token - fix the authorization header format
    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })

    // Verify user has admin access
    console.log('[admin-users] Verifying user authentication...');
    const {
      data: { user },
      error: authError
    } = await supabaseClient.auth.getUser(token)

    console.log('[admin-users] Auth error:', authError);
    console.log('[admin-users] User found:', !!user);
    console.log('[admin-users] User ID:', user?.id);

    if (authError) {
      console.error('[admin-users] Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed', details: authError.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!user) {
      console.error('[admin-users] No user found in token');
      return new Response(JSON.stringify({ error: 'No authenticated user found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[admin-users] User authenticated:', user.id);

    // Check if user is an admin
    console.log('[admin-users] Checking user profile for admin role...');
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, roles')
      .eq('id', user.id)
      .maybeSingle()

    console.log('[admin-users] Profile data:', profileData);
    console.log('[admin-users] Profile error:', profileError);

    if (profileError) {
      console.error('[admin-users] Profile query error:', profileError);
      return new Response(JSON.stringify({ error: 'Failed to verify user permissions', details: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!profileData) {
      console.error('[admin-users] No profile found for user:', user.id);
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check both role and roles array for admin access
    // Handle both array and non-array roles
    let userRoles = profileData?.roles || [];
    if (typeof userRoles === 'string') {
      userRoles = [userRoles];
    }
    
    const isAdmin = profileData?.role === 'admin' || userRoles.includes('admin');
    
    console.log('[admin-users] User role field:', profileData?.role);
    console.log('[admin-users] User roles array:', userRoles);
    console.log('[admin-users] Is admin:', isAdmin);
    
    if (!isAdmin) {
      console.error('[admin-users] User lacks admin privileges. Role:', profileData?.role, 'Roles:', userRoles);
      return new Response(JSON.stringify({ 
        error: 'Admin privileges required', 
        userRole: profileData?.role,
        userRoles: userRoles
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[admin-users] Admin access verified');

    // Get the action from the request body
    const { action, userId, data: actionData } = await req.json()
    console.log('[admin-users] Action requested:', action);

    switch (action) {
      case 'listUsers': {
        console.log('[admin-users] Fetching all users...');
        
        // Get all users using the admin client
        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (authError) {
          console.error('[admin-users] Error fetching auth users:', authError)
          throw authError
        }

        console.log('[admin-users] Auth users fetched:', authUsers.users.length);

        // Get profiles data to merge with auth data
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('*')

        if (profilesError) {
          console.error('[admin-users] Error fetching profiles:', profilesError)
          throw profilesError
        }

        console.log('[admin-users] Profiles fetched:', profiles?.length || 0);

        // Merge auth users with profile data
        const users = authUsers.users.map((authUser) => {
          const profile = profiles?.find((p) => p.id === authUser.id) || {}
          
          // Debug specific user data
          if (authUser.email === 'robert.martinez@example.com' || authUser.email === 'jennifer.thompson@example.com' || authUser.user_metadata?.display_name?.includes('Nikki')) {
            console.log('[admin-users] Debug user transformation:', {
              email: authUser.email,
              auth_role: authUser.role,
              profile_role: profile.role,
              profile_roles: profile.roles,
              profile_roles_type: typeof profile.roles
            });
          }
          
          // Ensure roles is always an array and handle PostgreSQL array format
          let roles = profile.roles || ['student'];
          
          // Handle PostgreSQL array format like "{admin,student}"
          if (typeof roles === 'string') {
            if (roles.startsWith('{') && roles.endsWith('}')) {
              roles = roles.slice(1, -1).split(',').filter(role => role.trim());
            } else {
              roles = [roles];
            }
          }
          
          // Clean and validate roles array
          roles = roles.filter((role: string) => role && typeof role === 'string' && role.trim() !== '');
          if (roles.length === 0) {
            roles = ['student'];
          }

          const transformedUser = {
            ...authUser,
            ...profile,
            providers: authUser.app_metadata?.providers || ['email'],
            role: profile.role || getHighestRole(roles),
            roles: roles
          };

          // Debug the final transformed user for specific cases
          if (authUser.email === 'robert.martinez@example.com' || authUser.email === 'jennifer.thompson@example.com' || authUser.user_metadata?.display_name?.includes('Nikki')) {
            console.log('[admin-users] Final transformed user:', {
              email: transformedUser.email,
              final_role: transformedUser.role,
              final_roles: transformedUser.roles,
              first_name: transformedUser.first_name,
              last_name: transformedUser.last_name
            });
          }

          return transformedUser;
        })

        console.log('[admin-users] Merged users prepared:', users.length);
        console.log('[admin-users] Sample roles distribution:', {
          admins: users.filter(u => u.role === 'admin' || (u.roles && u.roles.includes('admin'))).length,
          instructors: users.filter(u => u.role === 'instructor' || (u.roles && u.roles.includes('instructor'))).length,
          students: users.filter(u => u.role === 'student' || (u.roles && u.roles.includes('student'))).length
        });

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

        console.log('[admin-users] Updating user role:', userId, actionData.roles);

        // Ensure student role is always included
        const updatedRoles = Array.isArray(actionData.roles) ? actionData.roles : [actionData.roles];
        if (!updatedRoles.includes('student')) {
          updatedRoles.push('student');
        }

        // Determine the highest role for the role field
        const highestRole = getHighestRole(updatedRoles)

        // Update the user's profile
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .update({ 
            role: highestRole,
            roles: updatedRoles 
          })
          .eq('id', userId)
          .select()
          .single()

        if (error) {
          console.error('[admin-users] Error updating user role:', error)
          throw error
        }

        console.log('[admin-users] User role updated successfully');

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

        console.log('[admin-users] Deleting user:', userId);

        // Delete the user - this will cascade to the profile due to foreign key constraints
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (error) {
          console.error('[admin-users] Error deleting user:', error)
          throw error
        }

        console.log('[admin-users] User deleted successfully');

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

        console.log('[admin-users] Sending password reset for:', actionData.email);

        // Send password reset email
        const { error } = await supabaseAdmin.auth.admin.sendPasswordResetEmail(actionData.email)

        if (error) {
          console.error('[admin-users] Error sending password reset:', error)
          throw error
        }

        console.log('[admin-users] Password reset sent successfully');

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default: {
        console.error('[admin-users] Unknown action:', action);
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  } catch (error) {
    console.error('[admin-users] Edge function error:', error)
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
