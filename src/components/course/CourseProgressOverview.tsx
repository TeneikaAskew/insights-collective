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

  // Get comprehensive course statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['course-stats', courseId, studentId],
    queryFn: async () => {
      // Get all module progress
      const moduleProgressPromises = course?.modules.map(module =>
        supabase.rpc('calculate_module_progress', {
          p_module_id: module.id,
          p_student_id: studentId,
        }).single()
      ) || [];

      const moduleProgressResults = await Promise.all(moduleProgressPromises);
      
      // Calculate aggregated stats
      let totalLessons = 0;
      let completedLessons = 0;
      let totalAssignments = 0;
      let completedAssignments = 0;
      let totalQuizzes = 0;
      let completedQuizzes = 0;
      let completedModules = 0;

      moduleProgressResults.forEach((result) => {
        if (result.data) {
          totalLessons += result.data.total_lessons;
          completedLessons += result.data.completed_lessons;
          totalAssignments += result.data.total_assignments;
          completedAssignments += result.data.completed_assignments;
          totalQuizzes += result.data.total_quizzes;
          completedQuizzes += result.data.completed_quizzes;
          
          if (result.data.progress_percentage === 100) {
            completedModules++;
          }
        }
      });

      // Get average grade
      const { data: grades } = await supabase
        .from('grades')
        .select('percentage')
        .eq('course_id', courseId)
        .eq('student_id', studentId)
        .not('percentage', 'is', null);

      const averageGrade = grades && grades.length > 0
        ? grades.reduce((sum, g) => sum + g.percentage!, 0) / grades.length
        : 0;

      // Get time spent (simplified - you might want to aggregate from content_progress)
      const { data: progressData } = await supabase
        .from('content_progress')
        .select('time_spent')
        .eq('user_id', studentId);
      
      const timeSpent = progressData
        ? progressData.reduce((sum, p) => sum + (p.time_spent || 0), 0)
        : 0;

      // Get last activity
      const { data: lastActivityData } = await supabase
        .from('content_progress')
        .select('last_accessed')
        .eq('user_id', studentId)
        .order('last_accessed', { ascending: false })
        .limit(1)
        .single();

      const totalItems = totalLessons + totalAssignments + totalQuizzes;
      const completedItems = completedLessons + completedAssignments + completedQuizzes;
      const overallProgress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

      return {
        totalModules: course?.modules.length || 0,
        completedModules,
        totalLessons,
        completedLessons,
        totalAssignments,
        completedAssignments,
        totalQuizzes,
        completedQuizzes,
        overallProgress,
        averageGrade,
        timeSpent,
        lastActivity: lastActivityData?.last_accessed || null,
      } as CourseStats;
    },
    enabled: !!course,
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

  if (statsLoading || !stats) {
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