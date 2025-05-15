// Just fixing the specific typing issue in useConversationMessages.ts
// Find the problematic function where Profile type conversion happens and update it
// This is just a partial update focusing on the typing error

import { Profile } from '@/types/supabase';

// Only updating the specific function with the typing error (line 116)
// For a real implementation we'd need the full file, but here we're just fixing the conversion issue

export const convertToProfile = (userData: any): Profile => {
  // Ensure type safety by explicitly constructing a Profile object
  return {
    id: userData.id,
    first_name: userData.first_name || null,
    last_name: userData.last_name || null,
    avatar_url: userData.avatar_url || null,
    bio: userData.bio || null,
    role: userData.role || null,
    roles: userData.roles || []
  };
};

// Note: This is a partial update. In a real implementation, 
// you would update the full file where this function is used.
