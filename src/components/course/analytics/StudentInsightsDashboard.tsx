/**
 * Student Insights Dashboard
 * Comprehensive analytics view for individual student performance
 */

import React, { useState, useEffect } from 'react';
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

interface ActivityData {
  date: string;
  timeSpent: number;
  activitiesCompleted: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const StudentInsightsDashboard: React.FC<StudentInsightsProps> = ({
  studentId: propStudentId,
  courseId,
}) => {
  const { user } = useAuth();
  const studentId = propStudentId || user?.id;

  const [loading, setLoading] = useState(true);
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

      // Load course info
      const { data: course } = await supabase
        .from('courses')
        .select('id, title, description')
        .eq('id', courseId)
        .single();

      setCourseInfo(course);

      // Load student profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .eq('id', studentId)
        .single();

      setStudentInfo(profile);

      // Load module progress
      const { data: modules } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseId);

      const totalModules = modules?.length || 0;

      const { data: completedModules } = await supabase
        .from('module_progressions')
        .select('module_id')
        .eq('user_id', studentId)
        .eq('workflow_state', 'completed')
        .in(
          'module_id',
          modules?.map((m) => m.id) || []
        );

      // Load assignment stats
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id')
        .eq('course_id', courseId);

      const totalAssignments = assignments?.length || 0;

      const { data: assignmentSubmissions } = await supabase
        .from('assignment_submissions')
        .select('assignment_id, grade, workflow_state')
        .eq('user_id', studentId)
        .in(
          'assignment_id',
          assignments?.map((a) => a.id) || []
        );

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
      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('id, content_item_id')
        .eq('content_item_id', courseId); // This needs to be fixed to get quizzes by course

      const totalQuizzes = quizzes?.length || 0;

      const { data: quizSubmissions } = await supabase
        .from('quiz_submissions')
        .select('quiz_id, score, workflow_state')
        .eq('user_id', studentId);

      const completedQuizzes =
        quizSubmissions?.filter((s) => s.workflow_state === 'complete').length || 0;

      const quizAverage =
        quizSubmissions && quizSubmissions.length > 0
          ? quizSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) /
            quizSubmissions.length
          : 0;

      // Load video stats
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

      // Get last activity
      const { data: lastActivity } = await supabase
        .from('content_item_progressions')
        .select('updated_at')
        .eq('user_id', studentId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

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

      // Generate activity timeline (mock data for now - would need activity logging)
      generateActivityTimeline();
    } catch (error) {
      console.error('Error loading student insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivities = async () => {
    if (!studentId) return;

    try {
      const { data } = await supabase
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

      setRecentActivities(data || []);
    } catch (error) {
      console.error('Error loading recent activities:', error);
    }
  };

  const generateActivityTimeline = () => {
    // Mock data - in production, this would come from actual activity logs
    const mockData: ActivityData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      mockData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        timeSpent: Math.floor(Math.random() * 120) + 30,
        activitiesCompleted: Math.floor(Math.random() * 5),
      });
    }
    setActivityData(mockData);
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
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold">Student Performance Dashboard</h2>
          {studentInfo && (
            <p className="text-muted-foreground mt-1">
              {[studentInfo.first_name, studentInfo.last_name].filter(Boolean).join(' ')} • {courseInfo?.title}
            </p>
          )}
        </div>
        <Badge variant="outline" className={`text-lg px-4 py-2 ${performanceLevel.color}`}>
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
                <CardDescription>Time spent and activities completed</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="timeSpent"
                      stroke="#8884d8"
                      name="Time Spent (min)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="activitiesCompleted"
                      stroke="#82ca9d"
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
                Assignment details would be displayed here with individual scores and feedback.
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
                Quiz details would be displayed here with individual scores and attempts.
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
