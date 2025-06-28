
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ThreadList from '@/components/forum/ThreadList';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Forum } from '@/types/forum';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

const ForumDetailPage: React.FC = () => {
  const { courseId, forumId } = useParams<{ courseId: string; forumId: string }>();
  
  const { data: forum, isLoading: isLoadingForum } = useQuery({
    queryKey: ['forum', forumId],
    queryFn: async () => {
      // Add null check for forumId
      if (!forumId) return null;
      
      const { data, error } = await supabase
        .from('forums')
        .select('*')
        .eq('id', forumId)
        .single();
        
      if (error) {
        console.error("Error fetching forum:", error);
        return null;
      }
      return data as Forum;
    },
    // Don't attempt to fetch if forumId is missing
    enabled: !!forumId
  });
  
  const { data: course, isLoading: isLoadingCourse } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      // Add null check for courseId
      if (!courseId) return null;
      
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();
        
      if (error) {
        console.error("Error fetching course:", error);
        return null;
      }
      return data;
    },
    // Don't attempt to fetch if courseId is missing
    enabled: !!courseId
  });
  
  return (
    <AppLayout>
      <div className="container py-6 max-w-5xl">
        <div className="mb-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink>
                  <Link to="/forums">Forums</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink>
                  <Link to={`/courses/${courseId}`}>{course?.title || 'Course'}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{forum?.title || 'Forum'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          
          <Button variant="ghost" size="sm" asChild className="mt-4">
            <Link to="/forums">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Forums
            </Link>
          </Button>
        </div>
        
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
