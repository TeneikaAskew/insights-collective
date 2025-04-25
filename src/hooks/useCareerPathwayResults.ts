
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseCareerReport } from '@/components/assistants/utils/CareerReportParser';
import { useAuth } from '@/contexts/AuthContext';

export const useCareerPathwayResults = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['careerPathwayResults', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      const { data, error } = await supabase
        .from('career_pathway_results')
        .select('report')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("Career pathway results query result:", data);
      
      if (error) throw error;
      
      // If no data was found, return a default object structure
      if (!data) {
        console.log("No career pathway data found");
        return {
          userName: 'there',
          summary: 'You haven\'t completed your career assessment yet.',
          recommendedRoles: [],
          skillsAndCourses: [],
          careerPathSteps: [],
          keyTakeaways: []
        };
      }

      try {
        // Parse the report data from the database
        const parsedReport = parseCareerReport(data.report);
        console.log("Successfully parsed career pathway results:", parsedReport);
        return parsedReport;
      } catch (err) {
        console.error("Error parsing career report:", err);
        // Return default structure in case of parsing error
        return {
          userName: 'there',
          summary: 'There was an error processing your career assessment data.',
          recommendedRoles: [],
          skillsAndCourses: [],
          careerPathSteps: [],
          keyTakeaways: []
        };
      }
    },
    enabled: !!user?.id,
  });
};
