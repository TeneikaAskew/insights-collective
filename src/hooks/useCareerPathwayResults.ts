
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseCareerReport } from '@/components/assistants/utils/CareerReportParser';
import { useAuth } from '@/contexts/AuthContext';
import { CareerReportData } from '@/components/assistants/utils/types';

export const useCareerPathwayResults = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['careerPathwayResults', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      
      console.log("Fetching career pathway results for user:", user.id);
      
      // First try to get data from Supabase
      const { data, error } = await supabase
        .from('career_pathway_results')
        .select('report, action_plan')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("Career pathway results query result:", data);
      
      // If there's data in Supabase, parse and return it
      if (data && !error) {
        try {
          // Parse the career report
          const parsedReport = parseCareerReport(data.report);
          console.log("Successfully parsed career pathway report data");
          
          // Validate the action plan
          const actionPlan = data.action_plan;
          if (actionPlan && typeof actionPlan === 'object' && Object.keys(actionPlan).length > 0) {
            console.log("Found valid action plan data:", Object.keys(actionPlan));
          } else {
            console.log("No valid action plan found in database");
          }
          
          return {
            report: parsedReport,
            actionPlan: actionPlan
          };
        } catch (err) {
          console.error("Error parsing career report from Supabase:", err);
        }
      } else if (error) {
        console.error("Error fetching career pathway results:", error);
      } else {
        console.log("No career pathway results found for user");
      }
      
      // If no data in Supabase or parsing error, return a default structure
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
