import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  Calendar, 
  Clock,
  Download,
  ChevronRight,
  Award,
  BookOpen,
  FileText,
  ClipboardList
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ModuleProgressCard } from './ModuleProgressCard';
import { useCourseProgress } from '@/hooks/useCourseProgress';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface CourseProgressOverviewProps {
  courseId: string;
  studentId: string;
  onViewCertificate?: () => void;
  onNavigateToLesson?: (lessonId: string) => void;
}

interface CourseStats {
  totalModules: number;
  completedModules: number;
  totalLessons: number;
  completedLessons: number;
  totalAssignments: number;
  completedAssignments: number;
  totalQuizzes: number;
  completedQuizzes: number;
  overallProgress: number;
  averageGrade: number;
  timeSpent: number;
  lastActivity: string;
}

export const CourseProgressOverview: React.FC<CourseProgressOverviewProps> = ({
  courseId,
  studentId,
  onViewCertificate,
  onNavigateToLesson,
}) => {
  // Canonical progress: totals + percent come from useCourseProgress.
  // This removes the old RPC-based aggregation and the legacy content_progress reads.
  const { data: progress, isLoading: progressLoading } = useCourseProgress(courseId, studentId);

  // Get course details with modules
  const { data: course } = useQuery({
    queryKey: ['course-with-modules', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          modules(
            id,
            title,
            description,
            order_index,
            unlock_at,
            prerequisites_met
          )
        `)
        .eq('id', courseId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Type-specific breakdown (lessons / assignments / quizzes) + grades.
  // Uses content_items + content_item_progressions directly (no legacy tables).
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['course-stats', courseId, studentId, progress?.completedItems],
    queryFn: async () => {
      // Fetch published content items for this course's modules
      const { data: modules } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseId)
        .eq('published', true);

      const moduleIds = (modules || []).map((m) => m.id);
      const { data: items } = moduleIds.length > 0
        ? await supabase
            .from('content_items')
            .select('id, type')
            .in('module_id', moduleIds)
            .eq('published', true)
        : { data: [] as { id: string; type: string }[] };

      const contentItems = items || [];
      const itemIds = contentItems.map((i) => i.id);

      // Completed progressions (read or completed)
      const { data: progressions } = itemIds.length > 0
        ? await supabase
            .from('content_item_progressions')
            .select('content_item_id, workflow_state')
            .eq('user_id', studentId)
            .in('content_item_id', itemIds)
        : { data: [] as { content_item_id: string; workflow_state: string }[] };

      const completedSet = new Set(
        (progressions || [])
          .filter((p) => p.workflow_state === 'read' || p.workflow_state === 'completed')
          .map((p) => p.content_item_id),
      );

      const byType = (type: string) => contentItems.filter((c) => c.type === type);
      const countCompleted = (type: string) =>
        byType(type).filter((c) => completedSet.has(c.id)).length;

      const totalLessons = byType('page').length;
      const completedLessons = countCompleted('page');
      const totalAssignments = byType('assignment').length;
      const completedAssignments = countCompleted('assignment');
      const totalQuizzes = byType('quiz').length;
      const completedQuizzes = countCompleted('quiz');

      // Module completion count (100%)
      const completedModules = (progress?.modules || []).filter((m) => m.percent === 100).length;

      // Grades (kept — not part of content_item_progressions)
      const { data: grades } = await supabase
        .from('grades')
        .select('percentage')
        .eq('course_id', courseId)
        .eq('student_id', studentId)
        .not('percentage', 'is', null);

      const averageGrade = grades && grades.length > 0
        ? grades.reduce((sum, g) => sum + (g.percentage || 0), 0) / grades.length
        : 0;

      return {
        totalModules: course?.modules.length || 0,
        completedModules,
        totalLessons,
        completedLessons,
        totalAssignments,
        completedAssignments,
        totalQuizzes,
        completedQuizzes,
        overallProgress: progress?.percent ?? 0,
        averageGrade,
        timeSpent: 0, // legacy content_progress dropped; reintroduce when tracking is back
        lastActivity: null,
      } as CourseStats;
    },
    enabled: !!course && !!progress,
  });

  // Check if course is completed
  const { data: isCompleted } = useQuery({
    queryKey: ['course-completion', courseId, studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('check_course_completion', {
          p_course_id: courseId,
          p_student_id: studentId,
        });
      
      if (error) throw error;
      return data;
    },
  });

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return 'text-green-600';
    if (grade >= 80) return 'text-blue-600';
    if (grade >= 70) return 'text-yellow-600';
    if (grade >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  if (progressLoading || statsLoading || !stats) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-2 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Course Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{course?.title}</CardTitle>
              <CardDescription className="mt-2">
                Track your progress and achievements in this course
              </CardDescription>
            </div>
            {isCompleted && (
              <Button onClick={onViewCertificate} className="gap-2">
                <Award className="h-4 w-4" />
                View Certificate
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overall Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Course Completion</span>
              <span className="font-medium">{Math.round(stats.overallProgress)}%</span>
            </div>
            <Progress value={stats.overallProgress} className="h-3" />
          </div>
          
          {isCompleted ? (
            <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg border border-green-200">
              <Trophy className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-700">
                Congratulations! You've completed this course!
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete all modules to earn your certificate
            </p>
          )}
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Modules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.completedModules}/{stats.totalModules}
            </div>
            <Progress 
              value={(stats.completedModules / stats.totalModules) * 100} 
              className="mt-2 h-1"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Average Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", getGradeColor(stats.averageGrade))}>
              {stats.averageGrade.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all graded items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(stats.timeSpent)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total study time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Last Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {stats.lastActivity 
                ? new Date(stats.lastActivity).toLocaleDateString()
                : 'No activity yet'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Keep the momentum!
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Progress Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Progress Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Lessons</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.completedLessons} of {stats.totalLessons} completed
                  </p>
                </div>
              </div>
              <Progress 
                value={(stats.completedLessons / stats.totalLessons) * 100} 
                className="w-32 h-2"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Assignments</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.completedAssignments} of {stats.totalAssignments} submitted
                  </p>
                </div>
              </div>
              <Progress 
                value={(stats.completedAssignments / stats.totalAssignments) * 100} 
                className="w-32 h-2"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Quizzes</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.completedQuizzes} of {stats.totalQuizzes} completed
                  </p>
                </div>
              </div>
              <Progress 
                value={(stats.completedQuizzes / stats.totalQuizzes) * 100} 
                className="w-32 h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module Progress */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Module Progress</h3>
        <Accordion type="single" collapsible className="space-y-4">
          {course?.modules
            .sort((a, b) => a.order_index - b.order_index)
            .map((module, index) => (
              <AccordionItem key={module.id} value={module.id}>
                <AccordionTrigger className="hover:no-underline">
                  <ModuleProgressCard
                    moduleId={module.id}
                    moduleTitle={module.title}
                    studentId={studentId}
                    isLocked={!module.prerequisites_met}
                    unlockDate={module.unlock_at}
                    showDetails={false}
                  />
                </AccordionTrigger>
                <AccordionContent>
                  <ModuleProgressCard
                    moduleId={module.id}
                    moduleTitle={module.title}
                    studentId={studentId}
                    isLocked={!module.prerequisites_met}
                    unlockDate={module.unlock_at}
                    onLessonClick={onNavigateToLesson}
                    showDetails={true}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
        </Accordion>
      </div>
    </div>
  );
};