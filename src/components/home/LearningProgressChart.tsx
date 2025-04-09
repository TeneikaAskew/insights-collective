
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const data = [
  { name: 'Jan', progress: 30, target: 40 },
  { name: 'Feb', progress: 45, target: 50 },
  { name: 'Mar', progress: 60, target: 60 },
  { name: 'Apr', progress: 70, target: 70 },
  { name: 'May', progress: 85, target: 80 },
  { name: 'Jun', progress: 90, target: 90 },
];

const chartConfig = {
  progress: {
    label: 'Your Progress',
    theme: {
      light: '#8884d8',
      dark: '#a78bfa'
    }
  },
  target: {
    label: 'Target Goal',
    theme: {
      light: '#82ca9d',
      dark: '#86efac'
    }
  }
};

const LearningProgressChart = () => {
  return (
    <div className="rounded-lg bg-background/50 overflow-hidden">
      <div className="p-4">
        <h4 className="text-base font-medium">Learning Progress Over Time</h4>
        <p className="text-sm text-muted-foreground">Track your course completion and learning targets</p>
      </div>
      <div className="h-[300px] p-2">
        <ChartContainer config={chartConfig}>
          <LineChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent />
              }
            />
            <Line 
              type="monotone" 
              dataKey="progress" 
              activeDot={{ r: 8 }} 
              strokeWidth={2}
              dot={{ strokeWidth: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="target" 
              strokeDasharray="5 5" 
              strokeWidth={2}
              dot={{ strokeWidth: 2 }}
            />
            <Legend />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
};

export default LearningProgressChart;
