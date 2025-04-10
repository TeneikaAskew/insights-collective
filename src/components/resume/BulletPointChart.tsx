
import React from 'react';
import { BulletAnalysis } from '@/components/assistants/types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface BulletPointChartProps {
  bullet: BulletAnalysis;
}

const BulletPointChart: React.FC<BulletPointChartProps> = ({
  bullet
}) => {
  // Add fallback for when bullet properties are undefined
  const {
    word_balance = { industry_pct: 0, common_pct: 0, action_pct: 0, metric_pct: 0 },
    bullet_total = 0,
    xyz_scores = { hard_soft: 0, action_words: 0, measurable_results: 0, clarity_focus: 0 },
    original = ""
  } = bullet || {};

  // Format data for the chart with colors matching the theme
  const data = [
    {
      name: 'Hard & Soft Skills',
      value: xyz_scores.hard_soft || 0,
      fill: '#9b87f5', // Primary Purple from theme
      target: 35,
      percent: 0
    },
    {
      name: 'Action Words',
      value: xyz_scores.action_words || 0,
      fill: '#F97316', // Bright Orange from theme
      target: 15,
      percent: 0
    },
    {
      name: 'Measurable Results',
      value: xyz_scores.measurable_results || 0,
      fill: '#0EA5E9', // Ocean Blue from theme
      target: 15,
      percent: 0
    },
    {
      name: 'Common Words',
      value: xyz_scores.clarity_focus || 0,
      fill: '#8E9196', // Neutral Gray from theme
      target: 35,
      percent: 0
    }
  ];

  // Calculate actual percentages (with safety check to avoid division by zero)
  const totalScore = data.reduce((sum, item) => sum + item.value, 0);
  const dataWithPercent = data.map(item => ({
    ...item,
    percent: Math.round(item.value / (totalScore || 1) * 100)
  }));

  // Function to determine if target is met
  const isTargetMet = (actual: number, target: number) => {
    return actual >= target - 5 && actual <= target + 5;
  };

  return (
    <div className="mt-4 border rounded-lg p-6 bg-white shadow-sm">
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
