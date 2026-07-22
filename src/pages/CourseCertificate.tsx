import { useParams } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CertificationSystem from '@/components/certification/CertificationSystem';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Award } from 'lucide-react';

const CourseCertificate = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();

  // Check if course is completed
  const { data: isCompleted, isLoading } = useQuery({
    queryKey: ['course-completion-check', courseId, user?.id],
    queryFn: async () => {
      if (!courseId || !user?.id) return false;

      const { data, error } = await supabase
        .rpc('check_course_completion', {
          p_course_id: courseId,
          p_student_id: user.id,
        });

      if (error) throw error;
      return data;
    },
    enabled: !!courseId && !!user?.id,
  });

  if (!user) {
    return (
      <CourseLayout>
        <Alert>
          <AlertDescription>
            Please log in to view your certificate.
          </AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  if (isLoading) {
    return (
      <CourseLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col items-center text-center pt-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Award className="h-8 w-8" />
          </div>
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
            Achievement unlocked
          </p>
          <h1 className="font-display text-4xl md:text-5xl leading-tight">
            {isCompleted ? 'Your certificate is ready' : 'Course certificate'}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl">
            {isCompleted
              ? 'Download, share, or verify your official proof of completion.'
              : 'Finish every required lesson and assignment to unlock your certificate.'}
          </p>
        </div>

        {!isCompleted && (
          <Alert>
            <AlertDescription>
              You must complete all course requirements before you can receive a certificate.
              Please check your progress page to see what's remaining.
            </AlertDescription>
          </Alert>
        )}

        <CertificationSystem
          courseId={courseId || ''}
          userId={user.id}
          mode="issue"
        />
      </div>
    </CourseLayout>
  );
};

export default CourseCertificate;
