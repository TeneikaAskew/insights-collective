
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { createLogger } from '@/utils/logger';

const logger = createLogger('FEEDBACK_CATEGORIES');

// Feedback categories dropdown options
export const FEEDBACK_CATEGORIES = {
  useful: [
    'Already knew this information',
    'Too basic',
    'Not relevant to my goals',
    'Presentation could be better',
    'Other'
  ],
  notUseful: [
    'Incomplete information',
    'Difficult to understand',
    'Not actionable',
    'Inaccurate content',
    'Not engaging',
    'Other'
  ]
};

export const useFeedbackSubmission = (pagePath: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const submitFeedback = async (
    isUseful: boolean, 
    feedbackText?: string, 
    feedbackCategory?: string
  ) => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please log in to submit feedback',
        variant: 'destructive'
      });
      return false;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('user_feedback')
        .insert({
          page_path: pagePath,
          is_useful: isUseful,
          feedback_text: feedbackText || null,
          feedback_category: feedbackCategory || null,
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: 'Feedback Submitted',
        description: 'Thank you for your feedback!',
        variant: 'default'
      });

      return true;
    } catch (error) {
      logger.error('Feedback submission error:', error);
      toast({
        title: 'Feedback Submission Failed',
        description: 'Please try again later',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { submitFeedback, isLoading };
};
