
import React from 'react';
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  Cell,
  Label,
  Tooltip
} from 'recharts';

interface DistributionBarProps {
  item: {
    name: string;
    value: number;
    maxValue?: number;
    color: string;
    percent: number;
  };
}

// Score component with icon indicator
export const ScoreWithIcon: React.FC<{ score: number; maxScore?: number; size?: 'sm' | 'md' | 'lg' }> = ({
  score,
  maxScore = 100,
  size = 'md'
}) => {
  const scorePercent = Math.min(100, Math.round((score / maxScore) * 100));
  
  // Determine color based on score percentage
  let color = 'text-green-600';
  let bgColor = 'bg-green-100';
  
  if (scorePercent < 40) {
    color = 'text-red-600';
    bgColor = 'bg-red-100';
  } else if (scorePercent < 70) {
    color = 'text-amber-600';
    bgColor = 'bg-amber-100';
  }
  
  // Size classes
  const sizeClasses = {
    sm: 'text-lg px-1.5',
    md: 'text-xl px-2',
    lg: 'text-2xl px-3'
  };
  
  return (
    <span className={`${color} font-bold ${sizeClasses[size]} ${bgColor} rounded-md py-0.5 inline-flex items-center`}>
      {score}{maxScore ? `/${maxScore}` : ''}
    </span>
  );
};

export const BulletDonutChart: React.FC<{ data: any[]; totalScore: number }> = ({ data, totalScore }) => {
  // Round the score to the nearest whole number
  const roundedScore = Math.round(totalScore);
  
  // Determine rating text and color
  let ratingText = 'Poor';
  let ratingColor = '#EF4444'; // red
  
  if (roundedScore >= 90) {
    ratingText = 'Excellent';
    ratingColor = '#22C55E'; // green
  } else if (roundedScore >= 75) {
    ratingText = 'Very Good';
    ratingColor = '#65A30D'; // lime
  } else if (roundedScore >= 60) {
    ratingText = 'Good';
    ratingColor = '#F59E0B'; // amber
  } else if (roundedScore >= 40) {
    ratingText = 'Fair';
    ratingColor = '#F97316'; // orange
  }

  return (
    <div className="h-[250px] flex justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            cornerRadius={6}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <Label
              position="center"
              content={({ viewBox }) => {
                if (!viewBox) return null;
                const { cx, cy } = viewBox;
                return (
                  <>
                    <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="central" className="text-xl font-bold fill-current">
                      {roundedScore}
                    </text>
                    <text x={cx} y={cy + 20} textAnchor="middle" dominantBaseline="central" className="text-sm fill-current" style={{ fill: ratingColor }}>
                      {ratingText}
                    </text>
                  </>
                );
              }}
            />
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value}%`, name]}
            contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DistributionBar: React.FC<DistributionBarProps> = ({ item }) => {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium">{item.name}</span>
        <span className="font-semibold">
          {item.maxValue !== undefined ? `${item.value}/${item.maxValue}` : `${item.percent}%`}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${item.percent}%`,
            backgroundColor: item.color,
          }}
        />
      </div>
    </div>
  );
};

export const ScoreSummaryBox: React.FC<{
  title: string;
  score: number;
  maxScore?: number;
  description: string;
  className?: string;
}> = ({ title, score, maxScore = 100, description, className = '' }) => {
  const percentage = Math.round((score / maxScore) * 100);
  
  let bgColor = 'bg-green-50';
  let textColor = 'text-green-700';
  let borderColor = 'border-green-200';
  
  if (percentage < 40) {
    bgColor = 'bg-red-50';
    textColor = 'text-red-700';
    borderColor = 'border-red-200';
  } else if (percentage < 70) {
    bgColor = 'bg-amber-50';
    textColor = 'text-amber-700';
    borderColor = 'border-amber-200';
  }
  
  return (
    <div className={`p-4 rounded-lg border ${borderColor} ${bgColor} ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <h4 className={`font-medium ${textColor}`}>{title}</h4>
        <span className={`font-bold text-lg ${textColor}`}>
          {score}{maxScore ? `/${maxScore}` : ''}
        </span>
      </div>
      <p className={`text-sm ${textColor} opacity-90`}>{description}</p>
    </div>
  );
};
