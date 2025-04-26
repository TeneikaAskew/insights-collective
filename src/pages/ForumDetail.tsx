
import React from 'react';
import { useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ThreadList from '@/components/forum/ThreadList';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Forum } from '@/types/forum';

const ForumDetailPage: React.FC = () => {
  const { courseId, forumId } = useParams<{ courseId: string; forumId: string }>();
  
  const { data: forum, isLoading: isLoadingForum } = useQuery({
    queryKey: ['forum', forumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forums')
        .select('*')
        .eq('id', forumId)
        .single();
        
      if (error) throw error;
      return data as Forum;
    }
  });
  
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
        {isLoadingForum ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : forum ? (
          <ThreadList forum={forum} courseName={course?.title} />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Forum not found.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ForumDetailPage;
