import React, { useState, useEffect } from 'react';
import { useAuthenticatedNavigation } from '@/hooks/useAuthenticatedNavigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import CourseCard from '@/components/common/CourseCard';
import { Button } from '@/components/ui/button';
import { mockService } from '@/lib/mockData';
import { useToast } from '@/hooks/use-toast';
import { Course } from '@/types';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import PageHeader from '@/components/common/PageHeader';
import { usePageOnboarding } from '@/hooks/usePageOnboarding';

const Courses = () => {
  // Add page onboarding
  usePageOnboarding({ tourId: 'courses' });

  const { user, isAuthenticated } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { navigateWithAuth } = useAuthenticatedNavigation();
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthenticated) {
      navigateWithAuth('/login', {
        requireAuth: true,
        message: "Please log in to view the courses page",
        title: "Authentication Required"
      });
    }
  }, [isAuthenticated, navigateWithAuth]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
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
          `);

        if (error) {
          throw error;
        }

        if (data) {
          const formattedCourses: Course[] = data.map(course => ({
            ...course,
            instructor: {
              id: course.instructor?.id || '',
              name: course.instructor
                ? `${course.instructor?.first_name || ''} ${course.instructor?.last_name || ''}`.trim()
                : 'Instructor',
              email: '',
              role: 'instructor',
              avatar: course.instructor?.avatar_url || '',
            },
            enrollmentCount: 0,
            modules: [],
            rating: 4.5,
            createdAt: course.created_at,
            updatedAt: course.updated_at,
            thumbnail: course.image_url || course.thumbnail || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97',
          }));
          setCourses(formattedCourses);
        }
      } catch (error: any) {
        console.error('Error fetching courses:', error);
        setError(error.message);
        toast({
          title: "Failed to load courses",
          description: error.message,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [toast]);

  return (
    <AppLayout>
      <OnboardingGuide tourId="courses" />
      <OnboardingGuide tourId="navigation" />
      
      <div className="space-y-6">
        <PageHeader 
          title="Courses"
          description="Build your data science skills with our curated learning paths"
          tourId="courses"
        />
        
        <div data-tour="courses-main">
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="flex justify-center p-12">
              <p className="text-red-500">Error: {error}</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Courses;
