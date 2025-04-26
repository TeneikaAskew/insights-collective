
import React from 'react';
import { useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ThreadDetailComponent from '@/components/forum/ThreadDetail';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Thread, Forum } from '@/types/forum';

const ThreadDetailPage: React.FC = () => {
  const { courseId, forumId, threadId } = useParams<{ courseId: string; forumId: string; threadId: string }>();
  
  const { data: thread, isLoading: isLoadingThread } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select(`
          *,
          author:user_id(
            first_name, 
            last_name,
            avatar_url
          )
        `)
        .eq('id', threadId)
        .single();
        
      if (error) throw error;
      return data as Thread;
    }
  });
  
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
        {isLoadingThread ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : thread ? (
          <ThreadDetailComponent 
            thread={thread} 
            courseName={course?.title} 
            forumName={forum?.title} 
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Thread not found.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ThreadDetailPage;
