
export const enrichProfileWithRoles = (profile: any) => {
  if (!profile) return null;
  
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
