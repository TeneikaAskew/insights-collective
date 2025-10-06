/**
 * Student Insights Page
 * Shows comprehensive analytics for a student in a course
 * Accessible by instructors (for any student) or students (for themselves)
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { StudentInsightsDashboard } from '@/components/course/analytics/StudentInsightsDashboard';
import { useAuth } from '@/contexts/AuthContext';

const StudentInsights = () => {
  const { courseId, studentId } = useParams<{ courseId: string; studentId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isInstructor = user?.roles?.includes('instructor') || user?.roles?.includes('admin');
  const isViewingOwnData = !studentId || studentId === user?.id;

  // Only instructors can view other students' data
  if (studentId && studentId !== user?.id && !isInstructor) {
    return (
      <CourseLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to view this student's data.
          </AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  if (!courseId) {
    return (
      <CourseLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Course ID is required.</AlertDescription>
        </Alert>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(`/courses/${courseId}`)}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Course
          </Button>
        </div>

        {/* Dashboard */}
        <StudentInsightsDashboard
          studentId={studentId}
          courseId={courseId}
        />
      </div>
    </CourseLayout>
  );
};

export default StudentInsights;
