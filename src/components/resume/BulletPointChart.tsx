
import React from 'react';
import { BulletAnalysis } from '@/components/assistants/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { CircleCheck, Activity, TrendingUp, CircleDot } from 'lucide-react';

interface BulletPointChartProps {
  bullet: BulletAnalysis;
}

const BulletPointChart: React.FC<BulletPointChartProps> = ({ bullet }) => {
  const { word_balance, bullet_total } = bullet;
  
  // Format data for the chart with colors matching the design
  const data = [
    { name: 'Hard & Soft Skills', value: bullet.xyz_scores.hard_soft, fill: '#3b82f6', target: 35, Icon: CircleCheck }, // Blue
    { name: 'Action Words', value: bullet.xyz_scores.action_words, fill: '#ef4444', target: 15, Icon: Activity }, // Red
    { name: 'Measurable Results', value: bullet.xyz_scores.measurable_results, fill: '#22c55e', target: 15, Icon: TrendingUp }, // Green
    { name: 'Common Words', value: bullet.xyz_scores.clarity_focus, fill: '#d1d5db', target: 35, Icon: CircleDot }  // Gray
  ];
  
  // Calculate actual percentages
  const totalScore = data.reduce((sum, item) => sum + item.value, 0);
  const dataWithPercent = data.map(item => ({
    ...item,
    percent: Math.round((item.value / (totalScore || 1)) * 100)
  }));
  
  // Original bullet text with highlights matching the example
  const originalText = bullet.original;
  
  // Function to determine if target is met
  const isTargetMet = (actual: number, target: number) => {
    return actual >= target - 5 && actual <= target + 5;
  };
  
  return (
    <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-gray-900">Resume Bullet Analysis</h3>
        <p className="text-lg mt-2 mb-4">
          <span className="text-blue-600 font-semibold">Spearheaded new training protocols</span> to reduce 
          <span className="text-red-500 font-semibold"> new hire onboarding</span> by 
          <span className="text-green-600 font-semibold"> 15%</span>
        </p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <h3 className="text-md font-semibold text-center mb-4">Bullet Anatomy</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={dataWithPercent}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {dataWithPercent.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <Label
                    value={bullet_total}
                    position="center"
                    fill="#374151"
                    style={{
                      fontSize: '32px',
                      fontWeight: 'bold',
                      fontFamily: 'Arial',
                    }}
                  />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-3xl font-bold">{bullet_total}</div>
              <div className="text-sm text-gray-500">Bullet Score</div>
            </div>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold">Distribution</h3>
            <div className="flex items-center space-x-8">
              <span className="text-sm font-medium">Actual</span>
              <span className="text-sm font-medium">Target</span>
            </div>
          </div>
          
          <div className="space-y-4">
            {dataWithPercent.map((item, index) => (
              <div key={index} className="relative">
                <div className="flex justify-between text-sm mb-1">
                  <div className="flex items-center">
                    <div className="w-4 h-4 mr-2 rounded-full" style={{ backgroundColor: item.fill }}></div>
                    <span>{item.name}</span>
                  </div>
                  <div className="flex items-center space-x-10">
                    <span className={isTargetMet(item.percent, item.target) ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                      {item.percent}%
                    </span>
                    <span className="text-gray-500">
                      {item.target}% (±5%)
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded">
                  <div 
                    className="h-full rounded" 
                    style={{ 
                      width: `${Math.min(100, item.percent)}%`,
                      backgroundColor: item.fill
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulletPointChart;
