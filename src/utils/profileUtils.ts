
import { Profile } from "@/types/supabase";

export const enrichProfileWithRoles = (profile: any): Profile => {
  if (!profile) return null as any;
  
  const roles = profile.roles || 
    (profile.role ? [profile.role, 'student'] : ['student']);
  
  // Ensure student is always included
  if (!roles.includes('student')) {
    roles.push('student');
  }
  
  return {
    ...profile,
    roles
  };
};
