
import React from 'react';
import { BulletAnalysis } from '@/components/assistants/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';

interface BulletPointChartProps {
  bullet: BulletAnalysis;
}

const BulletPointChart: React.FC<BulletPointChartProps> = ({ bullet }) => {
  const { word_balance, bullet_total } = bullet;
  
  // Format data for the chart
  const data = [
    { name: 'Hard & Soft Skills', value: bullet.xyz_scores.hard_soft, fill: '#3b82f6', target: 5 }, // Blue
    { name: 'Action Words', value: bullet.xyz_scores.action_words, fill: '#ef4444', target: 5 }, // Red
    { name: 'Measurable Results', value: bullet.xyz_scores.measurable_results, fill: '#22c55e', target: 5 }, // Green
    { name: 'Common Words', value: bullet.xyz_scores.clarity_focus, fill: '#d1d5db', target: 5 }  // Gray
  ];
  
  const wordBalanceData = [
    { name: 'Industry', value: word_balance.industry_pct, target: 45, fill: '#3b82f6' }, // Blue
    { name: 'Common', value: word_balance.common_pct, target: 25, fill: '#d1d5db' }, // Gray
    { name: 'Action', value: word_balance.action_pct, target: 15, fill: '#ef4444' }, // Red
    { name: 'Metric', value: word_balance.metric_pct, target: 15, fill: '#22c55e' }  // Green
  ];
  
  // Example bullet text highlighted by category
  const bulletText = bullet.original;
  
  return (
    <div className="mt-4 border rounded-lg p-4 bg-slate-50">
      <div className="text-center mb-4">
        <div className="text-lg font-bold text-gray-800">{bulletText}</div>
      </div>
      
      <div className="flex flex-col md:flex-row">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-center mb-2">Bullet Anatomy</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <Label
                  value={bullet_total}
                  position="center"
                  fill="#374151"
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    fontFamily: 'Arial',
                  }}
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
            {data.map((entry, index) => (
              <div key={index} className="flex items-center">
                <div className="w-3 h-3 mr-1 rounded-full" style={{ backgroundColor: entry.fill }}></div>
                <span>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex-1 mt-4 md:mt-0">
          <h3 className="text-sm font-medium text-center mb-2">Word Distribution</h3>
          <div className="space-y-2">
            {wordBalanceData.map((item, index) => (
              <div key={index} className="relative">
                <div className="flex justify-between text-xs mb-1">
                  <span>{item.name}</span>
                  <span className={item.value >= item.target - 5 && item.value <= item.target + 5 ? "text-green-600" : "text-red-600"}>
                    {item.value}% <span className="text-gray-500">Target: {item.target}%</span>
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded">
                  <div 
                    className="h-full rounded" 
                    style={{ 
                      width: `${Math.min(100, (item.value / item.target) * 100)}%`,
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
