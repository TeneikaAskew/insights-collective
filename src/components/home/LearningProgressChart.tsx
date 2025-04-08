
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const data = [
  { name: 'Jan', progress: 30, target: 40 },
  { name: 'Feb', progress: 45, target: 50 },
  { name: 'Mar', progress: 60, target: 60 },
  { name: 'Apr', progress: 70, target: 70 },
  { name: 'May', progress: 85, target: 80 },
  { name: 'Jun', progress: 90, target: 90 },
];

const LearningProgressChart = () => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Learning Progress Over Time</CardTitle>
        <CardDescription>Track your course completion and learning targets</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="progress" 
                stroke="#8884d8" 
                activeDot={{ r: 8 }} 
                name="Your Progress" 
              />
              <Line 
                type="monotone" 
                dataKey="target" 
                stroke="#82ca9d" 
                strokeDasharray="5 5" 
                name="Target Goal" 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default LearningProgressChart;
