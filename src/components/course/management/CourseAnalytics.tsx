
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { CalendarDays, Users, BookOpen } from 'lucide-react';

interface CourseAnalyticsProps {
  courseId?: string;
}

export default function CourseAnalytics({ courseId }: CourseAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [analyticsData, setAnalyticsData] = useState<any>({
    enrollmentTrend: [],
    contentEngagement: [],
    completionRate: [],
    modulePopularity: [],
  });

  useEffect(() => {
    if (courseId) {
      fetchAnalyticsData();
    }
  }, [courseId, timeRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      
      // Fetch all enrollments for this course
      const { data: allEnrollments, error: allEnrollmentError } = await supabase
        .from('enrollments')
        .select('enrolled_at, completion_status')
        .eq('course_id', courseId);
      
      if (allEnrollmentError) throw allEnrollmentError;
      
      // Filter enrollments by date range for trend
      const recentEnrollments = (allEnrollments || []).filter(enrollment => 
        new Date(enrollment.enrolled_at) >= new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      );
      
      // Get modules for this course first
      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseId);
      
      if (modulesError) throw modulesError;
      
      const moduleIds = modules?.map(m => m.id) || [];
      
      // Fetch content engagement data through proper joins
      let contentProgress: any[] = [];
      if (moduleIds.length > 0) {
        const { data: progressData, error: progressError } = await supabase
          .from('content_progress')
          .select(`
            content_block_id, 
            completed, 
            time_spent,
            user_id,
            content_blocks!inner(
              block_type,
              module_id
            )
          `)
          .in('content_blocks.module_id', moduleIds);
        
        if (progressError) throw progressError;
        contentProgress = progressData || [];
      }
      
      const enrollmentTrend = processEnrollmentTrend(recentEnrollments, days);
      const contentEngagement = processContentEngagement(contentProgress);
      const completionRate = processCompletionRate(allEnrollments || []);
      const modulePopularity = await fetchModulePopularity();
      const avgTimeInCourse = calculateAverageTimeInCourse(contentProgress);
      
      setAnalyticsData({
        enrollmentTrend,
        contentEngagement,
        completionRate,
        modulePopularity,
        totalEnrollments: allEnrollments?.length || 0,
        avgTimeInCourse,
      });
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processEnrollmentTrend = (enrollments: any[], days: number) => {
    const data = [];
    const now = new Date();
    let cumulativeEnrollments = 0;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayEnrollments = enrollments.filter(enrollment => 
        enrollment.enrolled_at.split('T')[0] === dateStr
      ).length;
      
      cumulativeEnrollments += dayEnrollments;
      
      data.push({
        date: dateStr,
        enrollments: dayEnrollments,
        cumulativeEnrollments,
      });
    }
    
    return data;
  };

  const calculateAverageTimeInCourse = (contentProgress: any[]) => {
    if (contentProgress.length === 0) return 0;
    
    const totalTimeSpent = contentProgress.reduce((sum, progress) => 
      sum + (progress.time_spent || 0), 0
    );
    
    // Get unique users
    const uniqueUsers = new Set(contentProgress.map(p => p.user_id)).size;
    
    return uniqueUsers > 0 ? Math.round(totalTimeSpent / uniqueUsers) : 0;
  };

  const processContentEngagement = (contentProgress: any[]) => {
    const typeCount: { [key: string]: number } = {};
    
    contentProgress.forEach(progress => {
      const blockType = progress.content_blocks?.block_type || 'other';
      typeCount[blockType] = (typeCount[blockType] || 0) + 1;
    });
    
    return Object.entries(typeCount).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));
  };

  const processCompletionRate = (enrollments: any[]) => {
    if (enrollments.length === 0) {
      return [
        { name: 'Completed', value: 0 },
        { name: 'In Progress', value: 0 },
        { name: 'Not Started', value: 0 },
      ];
    }
    
    const completed = enrollments.filter(e => (e.completion_status || 0) >= 100).length;
    const inProgress = enrollments.filter(e => (e.completion_status || 0) > 0 && (e.completion_status || 0) < 100).length;
    const notStarted = enrollments.filter(e => (e.completion_status || 0) === 0).length;
    
    return [
      { name: 'Completed', value: completed },
      { name: 'In Progress', value: inProgress },
      { name: 'Not Started', value: notStarted },
    ];
  };

  const fetchModulePopularity = async () => {
    try {
      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('id, title')
        .eq('course_id', courseId);
        
      if (modulesError) throw modulesError;
      
      const moduleViews = await Promise.all(
        (modules || []).map(async (module) => {
          const { data: progressData, error } = await supabase
            .from('content_progress')
            .select('id, content_blocks!inner(module_id)')
            .eq('content_blocks.module_id', module.id);
          
          return {
            name: module.title,
            views: progressData?.length || 0,
          };
        })
      );
      
      return moduleViews;
    } catch (error) {
      console.error('Error fetching module data:', error);
      return [];
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Course Analytics</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Enrollments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Users className="h-6 w-6 text-muted-foreground mr-3" />
              <div className="text-3xl font-bold">
                {analyticsData.totalEnrollments || 0}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Time in Course
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <CalendarDays className="h-6 w-6 text-muted-foreground mr-3" />
              <div className="text-3xl font-bold">
                {analyticsData.avgTimeInCourse || 0} min
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <BookOpen className="h-6 w-6 text-muted-foreground mr-3" />
              <div className="text-3xl font-bold">
                {(() => {
                  const totalUsers = analyticsData.completionRate.reduce((sum: number, item: any) => sum + item.value, 0);
                  const completedUsers = analyticsData.completionRate.find((item: any) => item.name === 'Completed')?.value || 0;
                  return totalUsers > 0 ? Math.round((completedUsers / totalUsers) * 100) : 0;
                })()}%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="enrollment" className="w-full">
        <TabsList>
          <TabsTrigger value="enrollment">Enrollment Trend</TabsTrigger>
          <TabsTrigger value="engagement">Content Engagement</TabsTrigger>
          <TabsTrigger value="completion">Completion Rate</TabsTrigger>
          <TabsTrigger value="modules">Module Popularity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="enrollment">
          <Card>
            <CardHeader>
              <CardTitle>Enrollment Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={analyticsData.enrollmentTrend}
                    margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cumulativeEnrollments"
                      name="Total Enrollments"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="enrollments"
                      name="Daily Enrollments"
                      stroke="#82ca9d"
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="engagement">
          <Card>
            <CardHeader>
              <CardTitle>Content Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analyticsData.contentEngagement}
                    margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" name="Engagement Score" fill="#8884d8">
                      {analyticsData.contentEngagement.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="completion">
          <Card>
            <CardHeader>
              <CardTitle>Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.completionRate}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {analyticsData.completionRate.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="modules">
          <Card>
            <CardHeader>
              <CardTitle>Module Popularity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analyticsData.modulePopularity}
                    margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="views" name="View Count" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
