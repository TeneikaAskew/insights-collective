
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

export const useForums = (courseId: string) => {
  const [mockForums, setMockForums] = useState([]);
  
  // Simple mock data for testing
  useEffect(() => {
    setMockForums([
      {
        id: '1',
        title: 'General Discussion',
        description: 'A place to discuss general topics related to this course.',
        course_id: courseId || '1'
      },
      {
        id: '2',
        title: 'Technical Questions',
        description: 'Ask and answer technical questions about the course content.',
        course_id: courseId || '1'
      }
    ]);
  }, [courseId]);
  
  const { data: forums, isLoading: isLoadingForums } = useQuery({
    queryKey: ['forums', courseId],
    queryFn: async () => {
      // For routes that don't have a courseId, use mock data
      if (!courseId) {
        console.log("No courseId provided, using mock forums");
        return mockForums;
      }
      
      try {
        const { data, error } = await supabase
          .from('forums')
          .select('*')
          .eq('course_id', courseId)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error("Error fetching forums:", error);
          return mockForums;
        }
        
        return data && data.length > 0 ? data : mockForums;
      } catch (err) {
        console.error("Exception while fetching forums:", err);
        return mockForums;
      }
    },
    // Always enabled to handle both course-specific and general forums
    enabled: true
  });
  
  return {
    forums,
    isLoadingForums
  };
};
