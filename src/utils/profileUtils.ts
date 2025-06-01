
import { Profile } from "@/types/supabase";

/**
 * Enriches a profile with consistent role information
 */
export const enrichProfileWithRoles = (profile: any): Profile => {
  if (!profile) return null as any;
  
  // Handle roles from the database - only use the roles array now
  let roles = profile.roles || ['student'];
  
  // Handle PostgreSQL array format like "{admin,student}"
  if (typeof roles === 'string') {
    if (roles.startsWith('{') && roles.endsWith('}')) {
      roles = roles.slice(1, -1).split(',').filter((role: string) => role.trim());
    } else {
      roles = [roles];
    }
  }
  
  // Clean and validate roles array
  roles = roles.filter((role: string) => role && typeof role === 'string' && role.trim() !== '');
  
  // Ensure student is always included
  if (!roles.includes('student')) {
    roles.push('student');
  }
  
  // Determine the highest role for backwards compatibility
  const getHighestRole = (roles: string[] = ['student']): string => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('instructor')) return 'instructor';
    return 'student';
  };
  
  return {
    ...profile,
    roles,
    role: getHighestRole(roles), // Keep for backwards compatibility
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

/**
 * Check if a user has a specific role
 */
export const userHasRole = (roles: string[] | null | undefined, targetRole: string): boolean => {
  if (!roles || !Array.isArray(roles)) return false;
  return roles.includes(targetRole);
};

/**
 * Check if a user is an admin
 */
export const isAdmin = (roles: string[] | null | undefined): boolean => {
  return userHasRole(roles, 'admin');
};

/**
 * Check if a user is an instructor
 */
export const isInstructor = (roles: string[] | null | undefined): boolean => {
  return userHasRole(roles, 'instructor');
};
