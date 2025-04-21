import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { BULLET_CATEGORIES } from './BulletChartData';

// Helper function to determine if target is met
export const isTargetMet = (actual: number, target: number) => {
  return actual >= target - 5 && actual <= target + 5;
};

// Chart data item structure
export interface ChartDataItem {
  name: string;
  value: number;
  fill: string;
  target: number;
  percent: number;
  category: string;
}

// Get color class based on category
export const getCategoryColorClass = (category: string): string => {
  switch (category) {
    case BULLET_CATEGORIES.HARD_SOFT:
      return 'bg-blue-800';
    case BULLET_CATEGORIES.ACTION:
      return 'bg-amber-600';
    case BULLET_CATEGORIES.MEASURABLE:
      return 'bg-teal-600';
    case BULLET_CATEGORIES.COMMON:
    default:
      return 'bg-gray-500';
  }
};

// Get text color class based on category
export const getCategoryTextColorClass = (category: string): string => {
  switch (category) {
    case BULLET_CATEGORIES.HARD_SOFT:
      return 'text-blue-800';
    case BULLET_CATEGORIES.ACTION:
      return 'text-amber-600';
    case BULLET_CATEGORIES.MEASURABLE:
      return 'text-teal-600';
    case BULLET_CATEGORIES.COMMON:
    default:
      return 'text-gray-500';
  }
};

// Donut chart component
export const BulletDonutChart: React.FC<{
  data: ChartDataItem[];
  totalScore: number;
}> = ({ data, totalScore }) => {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie 
            data={data} 
            cx="50%" 
            cy="50%" 
            innerRadius={60} 
            outerRadius={90} 
            paddingAngle={2} 
            dataKey="value"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="text-3xl font-bold">{totalScore}</div>
        <div className="text-sm text-gray-500">Bullet Score</div>
      </div>
    </div>
  );
};

// Modified DistributionBar component with scaled value and color logic & label change from Target to Goal
export const DistributionBar: React.FC<{
  item: ChartDataItem;
}> = ({ item }) => {
  // Calculate scaled percentage of actual over target
  // Use actual 'percent' (actual %) and target %
  // To prevent division by zero, fallback to 1
  const scaledPercent = Math.round((item.percent / (item.target || 1)) * 100);

  // Determine color: green if scaled >= 100, else red
  const actualColorClass = scaledPercent >= 100 ? "text-green-600 font-semibold" : "text-red-600 font-semibold";

  // Clamp width for the bar fill to max 100%
  const barFillWidth = Math.min(100, item.percent);

  // Determine if we need to show a line marker at the goal percentage on the bar (scaledPercent > 100%)
  // The bar itself shows actual%, so the line is at target%
  // We'll position line marker as % width of the container (target)
  
  return (
    <div className="relative">
      <div className="flex justify-between text-sm mb-1">
        <div className="flex items-center">
          <div className={`w-4 h-4 mr-2 rounded-full ${getCategoryColorClass(item.category)}`}></div>
          <span>{item.name}</span>
        </div>
        <div className="flex items-center space-x-10 whitespace-nowrap">
          {/* Show scaled actual percent value */}
          <span className={actualColorClass}>
            {scaledPercent}%
          </span>
          {/* Show Goal label instead of Target */}
          <span className="text-gray-500">
            {item.target}%
          </span>
        </div>
      </div>
      <div className="h-2 w-full bg-gray-200 rounded relative">
        {/* Actual bar fill */}
        <div 
          className={`h-full rounded ${getCategoryColorClass(item.category)}`}
          style={{
            width: `${barFillWidth}%`,
          }}
        />
        {/* If actual exceeds goal, show vertical line marker at goal*/}
        {scaledPercent > 100 && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-black dark:bg-white opacity-70"
            style={{
              left: `${item.target}%`,
              transform: "translateX(-50%)",
            }}
          />
        )}
      </div>
    </div>
  );
};

// Score display with icon component
export const ScoreWithIcon: React.FC<{
  score: number;
  maxScore: number;
  label: string;
}> = ({ score, maxScore, label }) => {
  const isPassing = score >= maxScore * 0.6; // 60% threshold
  
  return (
    <div className="flex items-center">
      {isPassing ? 
        <CheckCircle className="h-4 w-4 text-green-500 mr-2" /> : 
        <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />}
      <span>{label}: {score}/{maxScore}</span>
    </div>
  );
};
