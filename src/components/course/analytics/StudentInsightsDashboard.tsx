/**
 * Student Insights Dashboard
 * Comprehensive analytics view for individual student performance
 */

import React, { useState, useEffect } from 'react';
import { CHART_COLORS } from '@/lib/chartColors';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Video,
  FileText,
  MessageSquare,
  Award,
  Target,
  Activity,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import videoAnalyticsService from '@/services/videoAnalyticsService';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import CourseErrorState from '@/components/course/CourseErrorState';

interface StudentInsightsProps {
  studentId?: string; // If not provided, shows current user's dashboard
  courseId: string;
}

interface CourseStats {
  totalModules: number;
  completedModules: number;
  totalAssignments: number;
  completedAssignments: number;
  averageGrade: number;
  totalQuizzes: number;
  completedQuizzes: number;
  quizAverage: number;
  participationScore: number;
  lastActive: string | null;
}

// Note: there is intentionally no time-spent field here — the platform has no
// real time-tracking data yet, so we do not fabricate one.
interface ActivityData {
  date: string;
  activitiesCompleted: number;
}

const COLORS = CHART_COLORS;

export const StudentInsightsDashboard: React.FC<StudentInsightsProps> = ({
  studentId: propStudentId,
  courseId,
}) => {
  const { user } = useAuth();
  const studentId = propStudentId || user?.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [courseStats, setCourseStats] = useState<CourseStats | null>(null);
  const [videoStats, setVideoStats] = useState<any>(null);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [courseInfo, setCourseInfo] = useState<any>(null);
  const [studentInfo, setStudentInfo] = useState<any>(null);

  useEffect(() => {
    if (studentId && courseId) {
      loadStudentInsights();
    }
  }, [studentId, courseId]);

  const loadStudentInsights = async () => {
    if (!studentId) return;

    try {
      setLoading(true);
      setLoadError(null);

      // Load course info
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('id, title, description')
        .eq('id', courseId)
        .maybeSingle();

      if (courseError) throw courseError;
      setCourseInfo(course);

      // Load student profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .eq('id', studentId)
        .maybeSingle();

      if (profileError) throw profileError;
      setStudentInfo(profile);

      // Load module progress
      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseId);

      if (modulesError) throw modulesError;
      const totalModules = modules?.length || 0;

      // Module completion is derived from content_item_progressions — nothing
      // in the system writes module_progressions, so reading it always showed
      // 0 completed modules. A module counts as complete when every one of its
      // published content items is read/completed (same semantics as
      // useCourseProgress).
      const moduleIds = (modules ?? []).map((m) => m.id);
      let completedModules: { module_id: string }[] = [];
      if (moduleIds.length > 0) {
        const { data: moduleItems, error: moduleItemsError } = await supabase
          .from('content_items')
          .select('id, module_id')
          .in('module_id', moduleIds)
          .eq('published', true);
        if (moduleItemsError) throw moduleItemsError;

        const itemIds = (moduleItems ?? []).map((i) => i.id);
        let doneItemIds = new Set<string>();
        if (itemIds.length > 0) {
          const { data: itemProgress, error: itemProgressError } = await supabase
            .from('content_item_progressions')
            .select('content_item_id, workflow_state')
            .eq('user_id', studentId)
            .in('content_item_id', itemIds)
            .in('workflow_state', ['read', 'completed']);
          if (itemProgressError) throw itemProgressError;
          doneItemIds = new Set((itemProgress ?? []).map((p) => p.content_item_id));
        }

        const itemsByModule = new Map<string, string[]>();
        (moduleItems ?? []).forEach((i) => {
          itemsByModule.set(i.module_id, [...(itemsByModule.get(i.module_id) ?? []), i.id]);
        });
        completedModules = moduleIds
          .filter((mid) => {
            const items = itemsByModule.get(mid) ?? [];
            return items.length > 0 && items.every((iid) => doneItemIds.has(iid));
          })
          .map((mid) => ({ module_id: mid }));
      }

      // Load assignment stats
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id')
        .eq('course_id', courseId);

      if (assignmentsError) throw assignmentsError;
      const totalAssignments = assignments?.length || 0;

      const { data: assignmentSubmissions, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select('assignment_id, grade, workflow_state')
        .eq('user_id', studentId)
        .in(
          'assignment_id',
          assignments?.map((a) => a.id) || []
        );

      if (submissionsError) throw submissionsError;

      const completedAssignments =
        assignmentSubmissions?.filter(
          (s) => s.workflow_state === 'graded' || s.workflow_state === 'submitted'
        ).length || 0;

      const gradedAssignments = assignmentSubmissions?.filter(
        (s) => s.grade !== null && s.grade !== undefined
      );

      const averageGrade =
        gradedAssignments && gradedAssignments.length > 0
          ? gradedAssignments.reduce((sum, s) => sum + (s.grade || 0), 0) /
            gradedAssignments.length
          : 0;

      // Load quiz stats
      const { data: quizzes, error: quizzesError } = await supabase
        .from('quizzes')
        .select('id, content_item_id')
        .eq('content_item_id', courseId); // This needs to be fixed to get quizzes by course

      if (quizzesError) throw quizzesError;
      const totalQuizzes = quizzes?.length || 0;

      const { data: quizSubmissions, error: quizSubmissionsError } = await supabase
        .from('quiz_submissions')
        .select('quiz_id, score, workflow_state')
        .eq('user_id', studentId);

      if (quizSubmissionsError) throw quizSubmissionsError;

      const completedQuizzes =
        quizSubmissions?.filter((s) => s.workflow_state === 'complete').length || 0;

      const quizAverage =
        quizSubmissions && quizSubmissions.length > 0
          ? quizSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) /
            quizSubmissions.length
          : 0;

      // Load video stats. getStudentVideoSummary throws on failure — the
      // surrounding catch turns that into the dashboard-wide error state so a
      // broken analytics backend is never displayed as zero watch time.
      const videoSummary = await videoAnalyticsService.getStudentVideoSummary(
        studentId,
        courseId
      );

      setVideoStats(videoSummary);

      // Calculate participation score (simple algorithm)
      const participationScore = Math.min(
        100,
        Math.round(
          ((completedModules?.length || 0) / Math.max(totalModules, 1)) * 25 +
            (completedAssignments / Math.max(totalAssignments, 1)) * 25 +
            (completedQuizzes / Math.max(totalQuizzes, 1)) * 25 +
            ((videoSummary.completedVideos || 0) /
              Math.max(videoSummary.totalVideos || 1, 1)) *
              25
        )
      );

      // Get last activity. maybeSingle: a student with no activity yet is a
      // legitimate empty result, not an error.
      const { data: lastActivity, error: lastActivityError } = await supabase
        .from('content_item_progressions')
        .select('updated_at')
        .eq('user_id', studentId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastActivityError) throw lastActivityError;

      setCourseStats({
        totalModules,
        completedModules: completedModules?.length || 0,
        totalAssignments,
        completedAssignments,
        averageGrade,
        totalQuizzes,
        completedQuizzes,
        quizAverage,
        participationScore,
        lastActive: lastActivity?.updated_at || null,
      });

      // Load recent activities
      await loadRecentActivities();

      // Build the activity timeline from real progression records
      await generateActivityTimeline();
    } catch (error) {
      console.error('Error loading student insights:', error);
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivities = async () => {
    if (!studentId) return;

    // Errors propagate to loadStudentInsights' catch and surface in the
    // dashboard error state instead of being silently swallowed.
    const { data, error } = await supabase
      .from('content_item_progressions')
      .select(
        `
          *,
          content_items(
            id,
            title,
            type
          )
        `
      )
      .eq('user_id', studentId)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    setRecentActivities(data || []);
  };

  const generateActivityTimeline = async () => {
    if (!studentId) return;
    
    // Query real content_item_progressions for the last 7 days
    const timelineData: ActivityData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const { count, error } = await supabase
        .from('content_item_progressions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', studentId)
        .gte('updated_at', dayStart.toISOString())
        .lte('updated_at', dayEnd.toISOString());

      if (error) throw error;

      timelineData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        activitiesCompleted: count || 0,
      });
    }
    setActivityData(timelineData);
  };

  const getPerformanceLevel = (score: number): { label: string; color: string } => {
    if (score >= 90) return { label: 'Excellent', color: 'text-green-600' };
    if (score >= 80) return { label: 'Good', color: 'text-blue-600' };
    if (score >= 70) return { label: 'Average', color: 'text-yellow-600' };
    if (score >= 60) return { label: 'Needs Improvement', color: 'text-orange-600' };
    return { label: 'At Risk', color: 'text-red-600' };
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return <FileText className="h-4 w-4" />;
      case 'quiz':
        return <Target className="h-4 w-4" />;
      case 'page':
        return <BookOpen className="h-4 w-4" />;
      case 'external_url':
        return <Video className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <CourseErrorState
        title="Failed to load student insights"
        error="Student analytics could not be loaded right now. The data shown would be incomplete, so nothing is displayed instead."
        onRetry={loadStudentInsights}
      />
    );
  }

  if (!courseStats) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Unable to load student insights</AlertDescription>
      </Alert>
    );
  }

  const performanceLevel = getPerformanceLevel(courseStats.participationScore);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold break-words">Student Performance Dashboard</h2>
          {studentInfo && (
            <p className="text-muted-foreground mt-1">
              {[studentInfo.first_name, studentInfo.last_name].filter(Boolean).join(' ')} • {courseInfo?.title}
            </p>
          )}
        </div>
        <Badge variant="outline" className={`text-lg px-4 py-2 flex-shrink-0 ${performanceLevel.color}`}>
          {performanceLevel.label}
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courseStats.participationScore}%</div>
            <Progress value={courseStats.participationScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Last active{' '}
              {courseStats.lastActive
                ? formatDistanceToNow(new Date(courseStats.lastActive), { addSuffix: true })
                : 'Never'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Grade</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courseStats.averageGrade > 0 ? courseStats.averageGrade.toFixed(1) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {courseStats.completedAssignments} of {courseStats.totalAssignments} assignments
              graded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Module Completion</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courseStats.completedModules}/{courseStats.totalModules}
            </div>
            <Progress
              value={(courseStats.completedModules / Math.max(courseStats.totalModules, 1)) * 100}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Video Progress</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {videoStats?.completedVideos || 0}/{videoStats?.totalVideos || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {videoStats?.totalWatchTimeMinutes?.toFixed(0) || 0} mins watched
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Activity Timeline */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Activity Timeline (Last 7 Days)</CardTitle>
                <CardDescription>Activities completed per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="activitiesCompleted"
                      stroke="hsl(var(--ss-teal))"
                      name="Activities Completed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Completion Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Completion Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Modules</span>
                      <span className="text-sm font-medium">
                        {courseStats.completedModules}/{courseStats.totalModules}
                      </span>
                    </div>
                    <Progress
                      value={
                        (courseStats.completedModules / Math.max(courseStats.totalModules, 1)) *
                        100
                      }
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Assignments</span>
                      <span className="text-sm font-medium">
                        {courseStats.completedAssignments}/{courseStats.totalAssignments}
                      </span>
                    </div>
                    <Progress
                      value={
                        (courseStats.completedAssignments /
                          Math.max(courseStats.totalAssignments, 1)) *
                        100
                      }
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Quizzes</span>
                      <span className="text-sm font-medium">
                        {courseStats.completedQuizzes}/{courseStats.totalQuizzes}
                      </span>
                    </div>
                    <Progress
                      value={
                        (courseStats.completedQuizzes / Math.max(courseStats.totalQuizzes, 1)) * 100
                      }
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Videos</span>
                      <span className="text-sm font-medium">
                        {videoStats?.completedVideos || 0}/{videoStats?.totalVideos || 0}
                      </span>
                    </div>
                    <Progress
                      value={
                        ((videoStats?.completedVideos || 0) /
                          Math.max(videoStats?.totalVideos || 1, 1)) *
                        100
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivities.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="mt-1">{getActivityIcon(activity.content_items?.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {activity.content_items?.title || 'Unknown Activity'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.updated_at), { addSuffix: true })}
                        </p>
                      </div>
                      {activity.workflow_state === 'read' && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  ))}
                  {recentActivities.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent activity
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Performance</CardTitle>
              <CardDescription>
                {courseStats.completedAssignments} of {courseStats.totalAssignments} assignments
                completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Detailed assignment breakdown not yet available.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quizzes">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Performance</CardTitle>
              <CardDescription>
                Average score: {courseStats.quizAverage.toFixed(1)}%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Detailed quiz breakdown not yet available.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>All Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {getActivityIcon(activity.content_items?.type)}
                      <div>
                        <p className="text-sm font-medium">
                          {activity.content_items?.title || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.content_items?.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.updated_at), { addSuffix: true })}
                      </span>
                      <Badge variant={activity.workflow_state === 'read' ? 'default' : 'outline'}>
                        {activity.workflow_state}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentInsightsDashboard;
