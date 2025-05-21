
import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { ScoreWithIcon } from '../chart/ChartComponents';

// Helper function to get score color based on percentage
export const getScoreColor = (score: number, max: number) => {
  const percentage = score / max * 100;
  if (percentage >= 80) return "text-green-600";
  if (percentage >= 60) return "text-yellow-600";
  return "text-red-600";
};

// Helper function to get badge color based on percentage
export const getBadgeColor = (score: number, max: number) => {
  const percentage = score / max * 100;
  if (percentage >= 80) return "bg-green-100 text-green-800 border-green-200";
  if (percentage >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
};

// Implement WordBalanceScore component that was previously removed
export const WordBalanceScore: React.FC<{
  wordBalance: { industry_pct: number; common_pct: number; action_pct: number; metric_pct: number };
  wordBalanceScore: number;
}> = ({ wordBalance, wordBalanceScore }) => {
  return (
    <div>
      <h5 className="font-medium text-sm mb-2">Word Balance ({wordBalanceScore}/25)</h5>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Industry:</span>
          <span className="font-medium">{wordBalance?.industry_pct || 0}%</span>
        </div>
        <div className="flex justify-between">
          <span>Common:</span>
          <span className="font-medium">{wordBalance?.common_pct || 0}%</span>
        </div>
        <div className="flex justify-between">
          <span>Action:</span>
          <span className="font-medium">{wordBalance?.action_pct || 0}%</span>
        </div>
        <div className="flex justify-between">
          <span>Metric:</span>
          <span className="font-medium">{wordBalance?.metric_pct || 0}%</span>
        </div>
      </div>
    </div>
  );
};

// Implement XYZQualityScore component that was previously removed
export const XYZQualityScore: React.FC<{
  xyzScores: { action: number; metrics: number; clarity: number; industry: number; achievement: number };
}> = ({ xyzScores }) => {
  const totalScore = 
    (xyzScores?.action || 0) +
    (xyzScores?.metrics || 0) +
    (xyzScores?.clarity || 0) +
    (xyzScores?.industry || 0) +
    (xyzScores?.achievement || 0);

  return (
    <div>
      <h5 className="font-medium text-sm mb-2">XYZ Quality ({totalScore}/100)</h5>
      <div className="space-y-2">
        <ScoreWithIcon score={xyzScores?.action || 0} maxScore={10} label="Action Words" />
        <ScoreWithIcon score={xyzScores?.metrics || 0} maxScore={30} label="Metrics/Results" />
        <ScoreWithIcon score={xyzScores?.clarity || 0} maxScore={15} label="Clarity/Conciseness" />
        <ScoreWithIcon score={xyzScores?.industry || 0} maxScore={25} label="Industry Keywords" />
        <ScoreWithIcon score={xyzScores?.achievement || 0} maxScore={20} label="Achievement Focus" />
      </div>
    </div>
  );
};
