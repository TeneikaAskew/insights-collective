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
      
      
      console.log("data or error: ",data || error);

      // Destructure the result to get only the sections
      const { sections } = parseformatCareerPathwayReport(data);
      console.log(sections)
      
      if (error) throw error;
      console.log("Found career pathway results: ", data);
      
      // If no data was found, return a default object structure
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
      
      
      return sections;
    },
    enabled: !!user?.id,
  });

  console.log("Hook: Sections: ", sections)
};