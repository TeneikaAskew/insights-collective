
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useProfileUpdate');

export interface ProfileUpdateData {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  notification_settings?: {
    email: boolean;
    browser: boolean;
    frequency: 'daily' | 'weekly' | 'never';
  };
  preferences?: {
    language: string;
    timezone: string;
  };
}

export const useProfileUpdate = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const updateProfile = async (data: ProfileUpdateData) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      return true;
    } catch (error: any) {
      logger.error('Profile update error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { updateProfile, loading };
};
