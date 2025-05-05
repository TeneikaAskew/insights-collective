
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
          const parsedReport = parseCareerReport(data.report);
          console.log("Successfully parsed career pathway results from Supabase:", parsedReport);
          return {
            report: parsedReport,
            actionPlan: data.action_plan
          };
        } catch (err) {
          console.error("Error parsing career report from Supabase:", err);
        }
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
