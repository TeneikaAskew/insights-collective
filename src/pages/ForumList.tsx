
import React from 'react';
import { useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ForumListComponent from '@/components/forum/ForumList';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ForumListPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  
  const { data: course, isLoading: isLoadingCourse } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();
        
      if (error) throw error;
      return data;
    }
  });
  
  return (
    <AppLayout>
      <div className="container py-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Course Forums</h1>
          {isLoadingCourse ? (
            <Skeleton className="h-6 w-64" />
          ) : (
            <p className="text-muted-foreground">{course?.title}</p>
          )}
        </div>
        
        <ForumListComponent />
      </div>
    </AppLayout>
  );
};

export default ForumListPage;
