import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { BULLET_CATEGORIES } from './BulletChartData';

// Helper function to determine if target is met
export const isTargetMet = (score: number) => {
  return score >= 100 - 14 && score <= 100 + 14;
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
    case BULLET_CATEGORIES.ACTION:
      return 'bg-amber-600';
    case BULLET_CATEGORIES.METRICS:
      return 'bg-teal-600';
    case BULLET_CATEGORIES.CLARITY:
      return 'bg-blue-500';
    case BULLET_CATEGORIES.INDUSTRY:
      return 'bg-blue-800';
    case BULLET_CATEGORIES.ACHIEVEMENT:
      return 'bg-green-600';
    default:
      return 'bg-gray-500';
  }
};

// Get text color class based on category
export const getCategoryTextColorClass = (category: string): string => {
  switch (category) {
    case BULLET_CATEGORIES.ACTION:
      return 'text-amber-600';
    case BULLET_CATEGORIES.METRICS:
      return 'text-teal-600';
    case BULLET_CATEGORIES.CLARITY:
      return 'text-blue-500';
    case BULLET_CATEGORIES.INDUSTRY:
      return 'text-blue-800';
    case BULLET_CATEGORIES.ACHIEVEMENT:
      return 'text-green-600';
    default:
      return 'text-gray-500';
  }
};

// // Get color class based on category
// export const getCategoryColorClass = (category: string): string => {
//   switch (category) {
//     case BULLET_CATEGORIES.HARD_SOFT:
//       return 'bg-blue-800';
//     case BULLET_CATEGORIES.ACTION:
//       return 'bg-amber-600';
//     case BULLET_CATEGORIES.MEASURABLE:
//       return 'bg-teal-600';
//     case BULLET_CATEGORIES.COMMON:
//     default:
//       return 'bg-gray-500';
//   }
// };

// // Get text color class based on category
// export const getCategoryTextColorClass = (category: string): string => {
//   switch (category) {
//     case BULLET_CATEGORIES.HARD_SOFT:
//       return 'text-blue-800';
//     case BULLET_CATEGORIES.ACTION:
//       return 'text-amber-600';
//     case BULLET_CATEGORIES.MEASURABLE:
//       return 'text-teal-600';
//     case BULLET_CATEGORIES.COMMON:
//     default:
//       return 'text-gray-500';
//   }
// };

// Donut chart component
export const BulletDonutChart: React.FC<{
  data: ChartDataItem[];
  totalScore: number;
}> = ({
  data,
  totalScore
}) => {
  return <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="text-3xl font-bold">{totalScore}</div>
        <div className="text-sm text-gray-500">Story Score</div>
      </div>
    </div>;
};

// Distribution bar component
export const DistributionBar: React.FC<{
  item: ChartDataItem;
}> = ({
  item
}) => {
  // Calculate scaled score percentage = (actual / target) * 100
  const scaledScore = item.target > 0 ? Math.round(item.percent / item.target * 100) : 0;

  // Determine color of score: green if scaledScore >= 100%, else red
  const scoreColorClass = scaledScore >= 100 ? "text-green-600 font-semibold" : "text-red-600 font-semibold";

  // Bar width based on scaled score capped at 100%
  const barWidthPercent = Math.min(scaledScore, 100);
  return <div className="relative">
      <div className="flex justify-between text-sm mb-1">
        <div className="flex items-center">
          <div className={`w-4 h-4 mr-2 rounded-full ${getCategoryColorClass(item.category)}`}></div>
          <span>{item.name}</span>
        </div>
        <div className="flex items-center space-x-10">
          <span className={scoreColorClass}>
            {scaledScore}%
          </span>
        </div>
      </div>
      <div className="h-2 w-full bg-gray-200 rounded relative overflow-visible">
        <div className={`h-full rounded ${getCategoryColorClass(item.category)}`} style={{
        width: `${barWidthPercent}%`
      }}></div>
        {/* Line indicator for Goal at 100% */}
        <div className="absolute top-0 left-[60%] h-full w-[2px] bg-gray-900 opacity-40" style={{
        transform: 'translateX(-1px)'
      }} aria-label="Goal marker" title="Goal"></div>
      </div>
    </div>;
};

// Score display with icon component
export const ScoreWithIcon: React.FC<{
  score: number;
  maxScore: number;
  label: string;
}> = ({
  score,
  maxScore,
  label
}) => {
  const isPassing = score >= maxScore * 0.6; // 60% threshold

  return <div className="flex items-center">
      {isPassing ? <CheckCircle className="h-4 w-4 text-green-500 mr-2" /> : <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />}
      <span>{label}: {score}/{maxScore}</span>
    </div>;
};