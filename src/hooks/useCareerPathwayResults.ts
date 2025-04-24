import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseformatCareerPathwayReport } from '@/components/assistants/utils/CareerReportParser';
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
      
      console.log("Raw data:", data);
      if (error) throw error;
      
      if (!data) {
        return {
          userName: 'there',
          summary: 'You haven\'t completed your career assessment yet.',
          recommendedRoles: [],
          skillsAndCourses: [],
          careerPathSteps: [],
          keyTakeaways: []
        };
      }
      
      console.log("Before parsing - data.report:", data.report);
      
      // Destructure the result to get only the sections
      const result = parseformatCareerPathwayReport(data.report);
      console.log("Parse result:", result);
      console.log("Hook: Sections:", result.sections);
      
      return result.sections;
    },
    enabled: !!user?.id,
  });
};