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
      
      // console.log("Career pathway error check: ", data || error);
      if (error) throw error;
      console.log("Found a career pathway result: ", data);
      console.log("Parsed career pathway results: ", parseCareerReport(data);
      
      const parsedReport = parseCareerReport(data.report);
      console.log("Parsed career pathway results: ", parsedReport);
      
      
      
      // If no data was found, return a default object structure
      if (!data) {
        console.log("No data found")
        return {
          userName: 'there',
          summary: 'You haven\'t completed your career assessment yet.',
          recommendedRoles: [],
          skillsAndCourses: [],
          careerPathSteps: [],
          keyTakeaways: []
        };
      }

      const report = parseCareerReport(data);
      console.log("Post Parsing: ", report)
      
      return parseCareerReport(data.report);
      
    },
    keepPreviousData: true,
    enabled: !!user?.id,
  });
};