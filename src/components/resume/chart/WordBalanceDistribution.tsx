
import React from 'react';

interface WordBalanceProps {
  wordBalance?: {
    industry_pct: number;
    common_pct: number;
    action_pct: number;
    metric_pct: number;
  };
}

export const WordBalanceDistribution: React.FC<WordBalanceProps> = ({ wordBalance }) => {
  // Guard clause to prevent rendering with invalid data
  if (!wordBalance || Object.keys(wordBalance).length === 0) {
    return <div>No word balance data available</div>;
  }
  
  // Make sure all required properties exist, using defaults if not
  const safeWordBalance = {
    industry_pct: wordBalance.industry_pct || 0,
    common_pct: wordBalance.common_pct || 0,
    action_pct: wordBalance.action_pct || 0,
    metric_pct: wordBalance.metric_pct || 0
  };
  
  // Define the ideal target values
  const targets = {
    industry_pct: 45,
    common_pct: 25,
    action_pct: 15,
    metric_pct: 15
  };
  
  // Define colors that match the theme
  const colors = {
    industry_pct: "#8B5CF6", // purple
    common_pct: "#9F9EA1", // gray
    action_pct: "#F97316", // orange
    metric_pct: "#0EA5E9"  // blue
  };
  
  // Define labels
  const labels = {
    industry_pct: "Industry",
    common_pct: "Common",
    action_pct: "Action",
    metric_pct: "Metric"
  };
  
  // Helper function to check if target is met (within ±5%)
  const isTargetMet = (actual: number, target: number) => {
    return actual >= target - 5 && actual <= target + 5;
  };
  
  return (
    <div className="space-y-3">
      {Object.entries(safeWordBalance).map(([key, value]) => {
        const typedKey = key as keyof typeof safeWordBalance;
        const targetValue = targets[typedKey];
        const color = colors[typedKey];
        const label = labels[typedKey];
        
        // Create a stable key for the bar
        const stableKey = `word-balance-${label}-${targetValue}`;
        
        return (
          <div key={stableKey} className="space-y-1">
            <div className="flex justify-between text-sm mb-1">
              <span>{label}</span>
              <div className="flex space-x-4">
                <span className={isTargetMet(value, targetValue) ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                  {value}%
                </span>
                <span className="text-gray-500">
                  {targetValue}% (±5%)
                </span>
              </div>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded">
              <div 
                className="h-full rounded" 
                style={{
                  width: `${Math.min(100, value)}%`,
                  backgroundColor: color
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
