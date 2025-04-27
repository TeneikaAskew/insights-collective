
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ThreadDetailComponent from '@/components/forum/ThreadDetail';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Thread, Forum } from '@/types/forum';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

const ThreadDetailPage: React.FC = () => {
  const { courseId, forumId, threadId } = useParams<{ courseId: string; forumId: string; threadId: string }>();
  
  const { data: thread, isLoading: isLoadingThread } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      if (!threadId) return null;
      
      try {
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
      } catch (error) {
        console.error('Error fetching thread:', error);
        return null;
      }
    },
    enabled: !!threadId
  });
  
  const { data: forum, isLoading: isLoadingForum } = useQuery({
    queryKey: ['forum', forumId],
    queryFn: async () => {
      if (!forumId) return null;
      
      try {
        const { data, error } = await supabase
          .from('forums')
          .select('*')
          .eq('id', forumId)
          .single();
          
        if (error) throw error;
        return data as Forum;
      } catch (error) {
        console.error('Error fetching forum:', error);
        return null;
      }
    },
    enabled: !!forumId
  });
  
  const { data: course, isLoading: isLoadingCourse } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      if (!courseId) return null;
      
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single();
          
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching course:', error);
        return null;
      }
    },
    enabled: !!courseId
  });
  
  const isLoading = isLoadingThread || isLoadingForum || isLoadingCourse;
  
  return (
    <AppLayout>
      <div className="container py-6 max-w-5xl">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/forums">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Forums
            </Link>
          </Button>
        </div>
        
        {isLoading ? (
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
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">Thread Not Found</h2>
            <p className="text-muted-foreground mb-6">The thread you're looking for might have been removed or doesn't exist.</p>
            <Button asChild>
              <Link to="/forums">Return to Forums</Link>
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ThreadDetailPage;
