
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
      // In a real implementation, we would fetch real analytics data from the database
      // For this demo, we'll generate sample data
      
      // Mock data generation based on timeRange
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const enrollmentTrend = generateEnrollmentTrend(days);
      const contentEngagement = generateContentEngagement();
      const completionRate = generateCompletionRate();
      const modulePopularity = await fetchModulePopularity();
      
      setAnalyticsData({
        enrollmentTrend,
        contentEngagement,
        completionRate,
        modulePopularity,
      });
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateEnrollmentTrend = (days: number) => {
    const data = [];
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        enrollments: Math.floor(Math.random() * 5) + (days - i) / 5, // Random with slight uptrend
      });
    }
    
    return data;
  };

  const generateContentEngagement = () => {
    return [
      { name: 'Videos', value: Math.floor(Math.random() * 80) + 20 },
      { name: 'Texts', value: Math.floor(Math.random() * 60) + 30 },
      { name: 'Quizzes', value: Math.floor(Math.random() * 40) + 20 },
      { name: 'Assignments', value: Math.floor(Math.random() * 30) + 10 },
      { name: 'Downloads', value: Math.floor(Math.random() * 20) + 5 },
    ];
  };

  const generateCompletionRate = () => {
    return [
      { name: 'Completed', value: Math.floor(Math.random() * 40) + 20 },
      { name: 'In Progress', value: Math.floor(Math.random() * 30) + 30 },
      { name: 'Not Started', value: Math.floor(Math.random() * 20) + 10 },
    ];
  };

  const fetchModulePopularity = async () => {
    try {
      // In a real implementation, this would fetch actual module data with view counts
      const { data, error } = await supabase
        .from('modules')
        .select('id, title')
        .eq('course_id', courseId);
        
      if (error) throw error;
      
      return data?.map(module => ({
        name: module.title,
        views: Math.floor(Math.random() * 100) + 20,
      })) || [];
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
                {analyticsData.enrollmentTrend.reduce((sum: number, item: any) => sum + item.enrollments, 0).toFixed(0)}
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
                {Math.floor(Math.random() * 120) + 30} min
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
                {Math.floor(analyticsData.completionRate[0]?.value / 
                  analyticsData.completionRate.reduce((sum: number, item: any) => sum + item.value, 0) * 100)}%
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
                      dataKey="enrollments"
                      name="Enrollments"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
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
