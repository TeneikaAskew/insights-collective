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
import CourseErrorState from './CourseErrorState';
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

// A bar for an empty set is empty, never NaN.
const barValue = (done: number, total: number) => (total > 0 ? (done / total) * 100 : 0);

export const CourseProgressOverview: React.FC<CourseProgressOverviewProps> = ({
  courseId,
  studentId,
  onViewCertificate,
  onNavigateToLesson,
}) => {
  // Canonical progress: totals + percent come from useCourseProgress.
  // This removes the old RPC-based aggregation and the legacy content_progress reads.
  const {
    data: progress,
    isLoading: progressLoading,
    error: progressError,
    refetch: refetchProgress,
  } = useCourseProgress(courseId, studentId);

  /**
   * A module is locked while any module it depends on is unfinished.
   *
   * This replaces a `prerequisites_met` column that does not exist and never
   * did. `prerequisite_module_ids` is real; whether those are *met* depends on
   * the student, so it belongs here where their progress is already loaded.
   * Until progress resolves nothing is locked — showing every module as locked
   * during load would be worse than showing it unlocked for a moment.
   */
  const isModuleLocked = React.useCallback(
    (prerequisiteIds: string[] | null | undefined): boolean => {
      if (!prerequisiteIds?.length) return false;
      const completed = new Set(
        // Exact (every eligible item done), never a rounded or capped percent.
        (progress?.modules ?? []).filter((m) => m.isComplete).map((m) => m.moduleId),
      );
      if (completed.size === 0 && !progress) return false;
      return prerequisiteIds.some((id) => !completed.has(id));
    },
    [progress],
  );

  // Get course details with modules
  const {
    data: course,
    error: courseError,
    refetch: refetchCourse,
  } = useQuery({
    queryKey: ['course-with-modules', courseId],
    queryFn: async () => {
      // `modules` has position, not order_index, and has never had unlock_at or
      // prerequisites_met. Asking for all three returned 42703 on every load, so
      // this page showed "Failed to load course progress" to every role — the
      // e2e spec passed anyway because it only asserted that <main> was visible.
      //
      // Prerequisites are modeled as prerequisite_module_ids; whether they are
      // *met* is a per-student question the database does not answer, so it is
      // computed below from the progress this component already loads.
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          modules(
            id,
            title,
            description,
            position,
            prerequisite_module_ids
          )
        `)
        .eq('id', courseId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // T-10 B: every progress figure below comes from ONE snapshot of useCourseProgress (eligible IDs + done IDs).
  // The only extra read is the TYPE of each eligible item, keyed by the exact eligible ID set, so a change in the
  // eligible universe or the done set (even at the same count) re-derives the figures instead of reusing a cache.
  const eligibleKey = React.useMemo(
    () => (progress ? [...progress.eligibleItemIds].sort().join(',') : null),
    [progress],
  );
  const {
    data: typeById,
    isLoading: typesLoading,
    error: typesError,
    refetch: refetchTypes,
  } = useQuery({
    queryKey: ['course-item-types', courseId, eligibleKey],
    queryFn: async () => {
      const ids = progress!.eligibleItemIds;
      if (ids.length === 0) return new Map<string, string>();
      const { data, error } = await supabase.from('content_items').select('id, type').in('id', ids);
      if (error) throw new Error(error.message);
      return new Map((data || []).map((r: { id: string; type: string }) => [r.id, r.type]));
    },
    enabled: eligibleKey !== null,
  });

  // Grades are their own fact (graded assignment submissions), never part of the progress snapshot.
  const {
    data: averageGrade,
    isLoading: gradesLoading,
    error: gradesError,
    refetch: refetchGrades,
  } = useQuery({
    queryKey: ['course-average-grade', courseId, studentId],
    queryFn: async () => {
      // There is no `grades` table in the schema; the old query against it failed silently and always produced 0.
      const { data: courseAssignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, points')
        .eq('course_id', courseId);
      if (assignmentsError) throw new Error(assignmentsError.message);

      const assignmentIds = (courseAssignments || []).map((a) => a.id);
      const { data: gradedSubmissions, error: submissionsError } = assignmentIds.length > 0
        ? await supabase
            .from('assignment_submissions')
            .select('assignment_id, grade')
            .eq('user_id', studentId)
            .in('assignment_id', assignmentIds)
            .not('grade', 'is', null)
        : { data: [] as { assignment_id: string; grade: number }[], error: null };
      if (submissionsError) throw new Error(submissionsError.message);

      const pointsByAssignment = new Map((courseAssignments || []).map((a) => [a.id, a.points]));
      const gradePercentages = (gradedSubmissions || [])
        .map((s) => {
          const points = pointsByAssignment.get(s.assignment_id);
          return points && points > 0 ? (s.grade / points) * 100 : null;
        })
        .filter((p): p is number => p !== null);
      return gradePercentages.length > 0
        ? gradePercentages.reduce((sum, p) => sum + p, 0) / gradePercentages.length
        : 0;
    },
  });

  const stats = React.useMemo<CourseStats | null>(() => {
    if (!progress || !typeById || averageGrade === undefined) return null;
    const done = new Set(progress.doneItemIds);
    // Only eligible IDs are counted; a type row for anything else is ignored.
    const ofType = (type: string) => progress.eligibleItemIds.filter((id) => typeById.get(id) === type);
    const count = (type: string) => {
      const ids = ofType(type);
      return { total: ids.length, done: ids.filter((id) => done.has(id)).length };
    };
    const pages = count('page');
    const assignments = count('assignment');
    const quizzes = count('quiz');
    return {
      // Only eligible (published) modules, the same universe the progress read model counts.
      totalModules: progress.modules.length,
      completedModules: progress.modules.filter((m) => m.isComplete).length,
      totalLessons: pages.total,
      completedLessons: pages.done,
      totalAssignments: assignments.total,
      completedAssignments: assignments.done,
      totalQuizzes: quizzes.total,
      completedQuizzes: quizzes.done,
      overallProgress: progress.percent,
      averageGrade,
      timeSpent: 0, // legacy content_progress dropped; reintroduce when tracking is back
      lastActivity: null,
    };
  }, [progress, typeById, averageGrade]);
  const statsLoading = typesLoading || gradesLoading;
  const statsError = typesError || gradesError;
  const refetchStats = () => {
    if (typesError) void refetchTypes();
    if (gradesError) void refetchGrades();
  };

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
    if (grade >= 90) return 'text-ss-good';
    if (grade >= 80) return 'text-ss-teal';
    if (grade >= 70) return 'text-ss-warn';
    if (grade >= 60) return 'text-ss-warn';
    return 'text-ss-bad';
  };

  // Distinct error state: a failed fetch renders an error block instead of
  // falling back to the loading skeleton forever.
  const loadError = progressError || courseError || statsError;
  if (loadError) {
    return (
      <CourseErrorState
        title="Failed to load course progress"
        error={loadError}
        onRetry={() => {
          if (progressError) refetchProgress();
          if (courseError) refetchCourse();
          if (statsError) refetchStats();
        }}
      />
    );
  }

  if (progressLoading || statsLoading || !stats) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-2 bg-muted rounded"></div>
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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div className="min-w-0">
              <CardTitle className="break-words">{course?.title}</CardTitle>
              <CardDescription className="mt-2">
                Track your progress and achievements in this course
              </CardDescription>
            </div>
            {isCompleted && (
              <Button onClick={onViewCertificate} className="gap-2 flex-shrink-0">
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
            <div className="flex items-center gap-2 p-4 bg-ss-good-chip rounded-lg border border-ss-good">
              <Trophy className="h-5 w-5 text-ss-good" />
              <span className="font-medium text-ss-good">
                Congratulations! You've completed this course!
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              A certificate is issued once the course's requirements are met
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
              value={barValue(stats.completedModules, stats.totalModules)} 
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
                value={barValue(stats.completedLessons, stats.totalLessons)} 
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
                value={barValue(stats.completedAssignments, stats.totalAssignments)} 
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
                value={barValue(stats.completedQuizzes, stats.totalQuizzes)} 
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
            .slice()
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((module) => {
              const locked = isModuleLocked(module.prerequisite_module_ids);
              return (
                <AccordionItem key={module.id} value={module.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <ModuleProgressCard
                      moduleId={module.id}
                      moduleTitle={module.title}
                      studentId={studentId}
                      isLocked={locked}
                      showDetails={false}
                    />
                  </AccordionTrigger>
                  <AccordionContent>
                    <ModuleProgressCard
                      moduleId={module.id}
                      moduleTitle={module.title}
                      studentId={studentId}
                      isLocked={locked}
                      onLessonClick={onNavigateToLesson}
                      showDetails={true}
                    />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
        </Accordion>
      </div>
    </div>
  );
};