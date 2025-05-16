
import { Profile } from "@/types/supabase";

/**
 * Enriches a profile with consistent role information
 */
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
    roles,
    // Explicitly preserve the avatar_url to ensure it's not lost during transformation
    avatar_url: profile.avatar_url || null
  };
};

/**
 * Get initials from a user's first and last name
 */
export const getUserInitials = (firstName?: string | null, lastName?: string | null): string => {
  if (!firstName && !lastName) return '?';
  
  const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
  const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
  
  return firstInitial || lastInitial || '?';
};

/**
 * Get full name from first and last name components
 */
export const getFullName = (firstName?: string | null, lastName?: string | null): string => {
  if (!firstName && !lastName) return 'Unknown User';
  return [firstName, lastName].filter(Boolean).join(' ');
};
