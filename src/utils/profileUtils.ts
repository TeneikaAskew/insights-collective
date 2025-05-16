
import { Profile } from "@/types/supabase";

export const enrichProfileWithRoles = (profile: any): Profile => {
  if (!profile) return null as any;
  
  const roles = profile.roles || 
    (profile.role ? [profile.role, 'student'] : ['student']);
  
  // Ensure student is always included
  if (!roles.includes('student')) {
    roles.push('student');
  }
  
  // Ensure first_name and last_name exist for avatar fallback
  const firstName = profile.first_name || profile.user_metadata?.first_name || '';
  const lastName = profile.last_name || profile.user_metadata?.last_name || '';
  
  return {
    ...profile,
    roles,
    first_name: firstName,
    last_name: lastName,
    // Explicitly preserve the avatar_url to ensure it's not lost during transformation
    avatar_url: profile.avatar_url || profile.user_metadata?.avatar_url || null
  };
};
