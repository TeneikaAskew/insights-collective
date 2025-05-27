
import React from 'react';
import { useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Course } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import CourseHeader from '@/components/course/CourseHeader';
import CourseContent from '@/components/course/CourseContent';
import CourseSidebar from '@/components/course/CourseSidebar';

const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  
  const { data: course, isLoading, error } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      if (!id) throw new Error('Course ID is required');
      
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          instructor:profiles(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('id', id)
        .single();
        
      if (error) throw error;
      
      // Format the course data to match our Course type
      const formattedCourse: Course = {
        ...data,
        instructor: {
          id: data.instructor?.id || data.instructor_id || '',
          name: data.instructor 
            ? `${data.instructor?.first_name || ''} ${data.instructor?.last_name || ''}`.trim()
            : 'Instructor',
          email: '',
          role: 'instructor',
          avatar: data.instructor?.avatar_url || '',
        },
        enrollmentCount: 0,
        modules: [],
        rating: 4.5,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        thumbnail: data.image_url || data.thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
      };
      
      return formattedCourse;
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container py-6 space-y-6">
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !course) {
    return (
      <AppLayout>
        <div className="container py-6">
          <Alert variant="destructive">
            <AlertDescription>
              {error instanceof Error ? error.message : 'Course not found'}
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <CourseHeader course={course} />
        
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <CourseContent course={course} />
            </div>
            <div>
              <CourseSidebar course={course} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CourseDetail;
