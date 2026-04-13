// ABOUTME: Learning progress chart showing real enrollment progress data per course
// ABOUTME: Queries enrollments table for current user's course completion percentages

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const chartConfig = {
  progress: {
    label: 'Completion %',
    theme: {
      light: '#8884d8',
      dark: '#a78bfa'
    }
  }
};

interface CourseProgress {
  name: string;
  progress: number;
}

const LearningProgressChart = () => {
  const { user } = useAuth();
  const [data, setData] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('completion_status, courses(title)')
          .eq('user_id', user.id);

        const chartData: CourseProgress[] = (enrollments || []).map(e => ({
          name: ((e.courses as any)?.title || 'Course').substring(0, 20),
          progress: e.completion_status || 0,
        }));

        setData(chartData);
      } catch (err) {
        console.error('Error loading progress chart data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, [user]);

  if (loading) {
    return (
      <div className="rounded-lg bg-background/50 overflow-hidden">
        <div className="p-4">
          <h4 className="text-base font-medium">Learning Progress</h4>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg bg-background/50 overflow-hidden">
        <div className="p-4">
          <h4 className="text-base font-medium">Learning Progress</h4>
          <p className="text-sm text-muted-foreground">Enroll in courses to see your progress here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-background/50 overflow-hidden">
      <div className="p-4">
        <h4 className="text-base font-medium">Learning Progress</h4>
        <p className="text-sm text-muted-foreground">Your course completion percentages</p>
      </div>
      <div className="h-[300px] p-2">
        <ChartContainer config={chartConfig}>
          <BarChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false}
              fontSize={12}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false}
              domain={[0, 100]}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="progress" fill="var(--color-progress, #8884d8)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
};

export default LearningProgressChart;
