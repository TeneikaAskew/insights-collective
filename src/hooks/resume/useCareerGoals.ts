
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useCareerGoals');

export function useCareerGoals(userId?: string, resumeId?: string) {
  const [careerGoals, setCareerGoals] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Load career goals from local storage and database
  useEffect(() => {
    if (!userId) return;
    
    const loadCareerGoals = async () => {
      setIsLoading(true);
      
      // First try to load from localStorage (faster)
      const localGoals = localStorage.getItem(`career_goals_${userId}`);
      if (localGoals) {
        setCareerGoals(localGoals);
      }
      
      // Then check the database if we have a resumeId
      if (resumeId) {
        try {
          const { data, error } = await supabase
            .from('resumes')
            .select('career_goals')
            .eq('id', resumeId)
            .maybeSingle();
            
          if (error) {
            logger.error('Error loading career goals:', error);
          } else if (data?.career_goals) {
            setCareerGoals(data.career_goals);
            // Update local storage with the most recent data
            localStorage.setItem(`career_goals_${userId}`, data.career_goals);
          }
        } catch (err) {
          logger.error('Error in loading career goals:', err);
        }
      }
      
      setIsLoading(false);
    };
    
    loadCareerGoals();
  }, [userId, resumeId]);
  
  // Save goals locally
  const saveGoalsLocally = (goals: string) => {
    if (!userId) return;
    
    localStorage.setItem(`career_goals_${userId}`, goals);
  };
  
  // Save goals to database
  const saveGoals = async (goals: string) => {
    if (!userId || !resumeId) return;
    
    setIsSaving(true);
    
    try {
      // First save locally
      saveGoalsLocally(goals);
      
      // Then save to database
      const { error } = await supabase
        .from('resumes')
        .update({ career_goals: goals })
        .eq('id', resumeId);
        
      if (error) {
        logger.error('Error saving career goals:', error);
        return false;
      }
      
      return true;
    } catch (err) {
      logger.error('Error in saving career goals:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  };
  
  return {
    careerGoals,
    setCareerGoals,
    saveGoals,
    saveGoalsLocally,
    isSaving,
    isLoading
  };
}
