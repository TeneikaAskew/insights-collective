
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseCareerReport } from '@/components/assistants/utils/CareerReportParser';
import { useAuth } from '@/contexts/AuthContext';
import { CareerReportData } from '@/components/assistants/utils/types';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useCareerPathwayResults');

export const useCareerPathwayResults = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['careerPathwayResults', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      
      logger.log("Fetching career pathway results for user:", user.id);
      
      // First try to get data from Supabase
      const { data, error } = await supabase
        .from('career_pathway_results')
        .select('report, action_plan')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      logger.log("Career pathway results query result:", data);

      // A query failure must surface as an error state, not as
      // "assessment not completed yet".
      if (error) {
        logger.error("Error fetching career pathway results:", error);
        throw error;
      }

      // If there's data in Supabase, parse and return it
      if (data) {
        // Parse the career report — a parse failure means the stored report is
        // corrupted, which is an error, not a missing assessment.
        const parsedReport = parseCareerReport(data.report as string);
        logger.log("Successfully parsed career pathway report data");

        // Validate the action plan
        const actionPlan = data.action_plan;
        if (actionPlan && typeof actionPlan === 'object' && Object.keys(actionPlan).length > 0) {
          logger.log("Found valid action plan data:", Object.keys(actionPlan));
        } else {
          logger.log("No valid action plan found in database");
        }

        return {
          report: parsedReport,
          actionPlan: actionPlan
        };
      }

      logger.log("No career pathway results found for user");

      // Genuinely no results yet: return the empty "not completed" structure
      return {
        report: {
          userName: 'there',
          summary: 'You haven\'t completed your career assessment yet.',
          recommendedRoles: [],
          skillsAndCourses: [],
          careerPathSteps: [],
          keyTakeaways: [],
          nextStepRecommendations: '',
          potentialRoles: []
        },
        actionPlan: null
      };
    },
    enabled: !!user?.id,
  });
};
